import type {
  ToolAgentSetup,
  ToolFailure,
  ToolInternalTag,
  ToolResult
} from '@nekosu/maa-server-proto'

import {
  type AgentInfo,
  destroyAgent,
  destroyResourceAfterAgentCleanup,
  isAgentStopped,
  startAgent
} from '../agent'
import { ipc } from '../apis'
import { logger } from '../server'
import { requiredCustomRecognitions } from './customReco'
import { convertImage, setupFixedController } from './utils'

/** 快速识别缓存的 agent 会话：资源与 agent 复用，避免每次点按钮都重新拉起子进程 */
type QuickRecoSession = {
  key: string
  resource: maa.Resource
  agents: AgentInfo[]
  /** agent 连接后注册的 Custom 识别名 */
  customNames: Set<string>
}

/** 会话空闲多久后释放（毫秒） */
const SESSION_IDLE_MS = 5 * 60 * 1000

/**
 * 快速识别的 agent 调用超时：agent 假死时 native send_and_recv 默认无限等待，
 * 面板会一直卡在加载态。给有限超时后最多退化成一次「未命中」。
 */
const AGENT_CALL_TIMEOUT_MS = 60 * 1000

let session: QuickRecoSession | undefined
let sessionTimer: NodeJS.Timeout | undefined
let prevTask: string | undefined = undefined
let busy = false
/** 当前识别结束后需要释放会话（识别途中收到释放请求 / 启动正式实例） */
let disposeWhenIdle = false

/**
 * 会话资源上注册的 custom action 在执行时读取本变量。
 * busy 保证同一时刻只有一个识别请求，因此无需队列。
 */
let pending:
  | {
      task: string
      image: ArrayBuffer
      settle: (detail: string | null) => void
    }
  | undefined

function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer)
    sessionTimer = undefined
  }
}

function touchSession() {
  clearSessionTimer()
  if (!session) {
    return
  }
  sessionTimer = setTimeout(() => {
    // 用 release 而不是直接 dispose：极端情况下识别仍在进行
    releaseQuickRecoSession()
  }, SESSION_IDLE_MS)
  // 释放定时器不应阻止进程退出
  sessionTimer.unref()
}

/** 释放快速识别会话：销毁 agent 子进程与资源。识别进行中会推迟到本次识别结束 */
export function disposeQuickRecoSession() {
  clearSessionTimer()
  disposeWhenIdle = false
  const current = session
  session = undefined
  pending = undefined
  if (!current) {
    return
  }

  logger.info('quick reco session destroy')
  for (const agent of current.agents) {
    destroyAgent(agent)
  }
  // agent client 可能仍在 connect 清理中，Resource 必须晚于它销毁
  destroyResourceAfterAgentCleanup(current.resource)
}

/**
 * 外部（面板关闭、启动正式实例）请求释放会话。
 * 识别进行中直接销毁 native resource 有 use-after-free 风险，因此标记为结束后释放。
 */
export function releaseQuickRecoSession() {
  if (busy) {
    disposeWhenIdle = true
    return
  }
  disposeQuickRecoSession()
}

function settleBusy() {
  busy = false
  if (disposeWhenIdle) {
    disposeQuickRecoSession()
  }
}

function agentAlive(info: AgentInfo) {
  // Client.alive 只探测 ZMQ 发送就绪，进程被杀后可能仍为 true，需要配合宿主通知
  return info.client.alive && !isAgentStopped(info.agent)
}

function internalFailure(tag: ToolInternalTag, detail?: string): ToolResult {
  return {
    detail: null,
    failure: {
      kind: 'internal',
      tag,
      detail
    }
  }
}

function sessionKey(resources: string[], agent: ToolAgentSetup | undefined) {
  return JSON.stringify({
    resources,
    root: agent?.root,
    agentResources: agent?.resources,
    agents: agent?.agents
  })
}

async function createSession(resources: string[], key: string) {
  const resource = new maa.Resource()

  resource.add_sink((_, msg) => {
    logger.info(`${JSON.stringify(msg)}`)
  })

  try {
    for (const resourcePath of resources) {
      await resource.post_bundle(resourcePath).wait()
    }
    if (!resource.loaded) {
      logger.error('quick reco res load failed')
      resource.destroy()
      return null
    }

    resource.register_custom_action('@mse/action', async self => {
      const current = pending
      if (!current) {
        logger.warn('quick reco action called without pending request')
        return true
      }

      try {
        const detail = await self.context.run_recognition(current.task, current.image)
        if (!detail) {
          logger.info('quick reco recognition returned no detail')
          current.settle(null)
          return true
        }

        const presp = { ...detail } as Partial<typeof detail>
        delete presp.draws
        delete presp.raw
        current.settle(JSON.stringify(presp))
      } catch (err) {
        logger.error(`quick reco recognition failed: ${err}`)
        current.settle(null)
      }
      return true
    })
  } catch (err) {
    logger.error(`quick reco res create failed: ${err}`)
    resource.destroy()
    return null
  }

  return {
    key,
    resource,
    agents: [],
    customNames: new Set<string>()
  } satisfies QuickRecoSession
}

async function ensureSession(resources: string[], agent: ToolAgentSetup | undefined) {
  const key = sessionKey(resources, agent)
  // agent 中途退出后复用同一资源会一直拿不到结果，直接重建会话
  if (session && session.key === key && session.agents.every(agentAlive)) {
    touchSession()
    return session
  }

  disposeQuickRecoSession()
  const created = await createSession(resources, key)
  if (!created) {
    return null
  }

  session = created
  touchSession()
  return session
}

function missingNames(current: QuickRecoSession, requirements: readonly { name: string }[]) {
  return requirements.filter(item => !current.customNames.has(item.name)).map(item => item.name)
}

/**
 * 按待识别节点对 Custom 识别的需求，启动 interface agent 并校验注册覆盖。
 * 已启动过的 agent 会被复用；失败时整个会话作废，避免留下半连接的 agent。
 */
async function ensureAgents(
  current: QuickRecoSession,
  agent: ToolAgentSetup | undefined,
  requirements: readonly { name: string }[]
): Promise<ToolFailure | undefined> {
  if (missingNames(current, requirements).length === 0) {
    return undefined
  }

  if (!agent || agent.agents.length === 0) {
    return {
      kind: 'no-agent',
      names: missingNames(current, requirements)
    }
  }

  for (const agentConfig of agent.agents) {
    const info = await startAgent(
      agentConfig,
      {
        root: agent.root,
        resources: agent.resources,
        timeout: agent.timeout,
        callTimeout: AGENT_CALL_TIMEOUT_MS
      },
      current.resource
    )
    if (!info) {
      disposeQuickRecoSession()
      return {
        kind: 'agent-start-failed',
        target: agentConfig.child_exec ?? agentConfig.debug_session ?? '<unknown>'
      }
    }

    current.agents.push(info)
    for (const name of info.client.custom_recognition_list ?? []) {
      current.customNames.add(name)
    }
  }

  const stillMissing = missingNames(current, requirements)
  if (stillMissing.length > 0) {
    disposeQuickRecoSession()
    return {
      kind: 'unregistered',
      names: stillMissing
    }
  }

  return undefined
}

function pickNode(current: QuickRecoSession): Promise<string | null> {
  const tasks = current.resource.node_list
  if (!tasks) {
    logger.error('quick reco res no task')
    return Promise.resolve(null)
  }

  tasks.sort()
  if (prevTask) {
    const prevIdx = tasks.findIndex(x => x === prevTask)
    if (prevIdx !== -1) {
      tasks.splice(prevIdx, 1)
      tasks.unshift(prevTask)
    }
  }
  return ipc.quickPick(tasks)
}

async function performRecoInner(
  imageBase64: string,
  resources: string[],
  agent: ToolAgentSetup | undefined
): Promise<ToolResult | null> {
  const current = await ensureSession(resources, agent)
  if (!current) {
    return internalFailure('resource-load-failed', 'resource not loaded')
  }

  const task = await pickNode(current)
  if (!task) {
    return null
  }
  prevTask = task
  touchSession()

  let requirements
  try {
    requirements = requiredCustomRecognitions([task], node => current.resource.get_node_data(node))
  } catch (err) {
    logger.error(`quick reco scan custom recognition failed: ${err}`)
    return internalFailure('scan-failed', `${err}`)
  }

  const agentFailure = await ensureAgents(current, agent, requirements)
  if (agentFailure) {
    return {
      detail: null,
      failure: agentFailure
    }
  }

  const image = convertImage(imageBase64)
  const controller = await setupFixedController(image)
  if (!controller) {
    logger.error('quick reco ctrl create failed')
    return internalFailure('controller-create-failed', 'fixed controller not connected')
  }

  const tasker = new maa.Tasker()
  tasker.controller = controller
  tasker.resource = current.resource
  if (!tasker.inited) {
    logger.error('quick reco tasker create failed')
    tasker.destroy()
    controller.destroy()
    return internalFailure('tasker-create-failed', 'tasker not inited')
  }

  const detailPromise = new Promise<string | null>(resolve => {
    pending = {
      task,
      image,
      settle: detail => {
        pending = undefined
        resolve(detail)
      }
    }
  })

  try {
    await tasker
      .post_task('@mse/action', {
        '@mse/action': {
          action: 'Custom',
          custom_action: '@mse/action'
        }
      })
      .wait()
  } finally {
    // 任务没有走到 action（例如节点不存在）时也要让等待方拿到结果
    pending?.settle(null)
    tasker.destroy()
    setTimeout(() => {
      controller.destroy()
    }, 1000)
  }

  const detail = await detailPromise

  if (detail === null && requirements.length > 0) {
    const names = requirements.map(item => item.name)
    if (current.agents.some(info => !agentAlive(info))) {
      disposeQuickRecoSession()
      return {
        detail: null,
        failure: {
          kind: 'agent-exited',
          names
        }
      }
    }
    // Custom 识别没有返回 detail：通常是 agent 假死/识别未注册，不能当作「未命中」
    return {
      detail: null,
      failure: {
        kind: 'internal',
        tag: 'custom-recognition-failed'
      }
    }
  }

  return {
    detail
  }
}

export async function performReco(
  imageBase64: string,
  resources: string[],
  agent?: ToolAgentSetup
): Promise<ToolResult | null> {
  if (busy) {
    return {
      detail: null,
      failure: {
        kind: 'busy'
      }
    }
  }

  busy = true
  try {
    return await performRecoInner(imageBase64, resources, agent)
  } catch (err) {
    logger.error(`quick reco failed: ${err}`)
    return internalFailure('internal-error', `${err}`)
  } finally {
    settleBusy()
    touchSession()
  }
}
