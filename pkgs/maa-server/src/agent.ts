import { EventEmitter } from 'node:events'
import * as path from 'node:path'

import type { AgentRuntime } from '@nekosu/maa-pipeline-manager'

import { ipc } from './apis'
import { logger } from './server'
import { makePromise } from './utils'

export type AgentInfo = {
  client: maa.Client
  agent: string
  /** interface 声明的 identifier；未声明时 Client 自动生成，不会与其他 agent 冲突 */
  identifier?: string
}

/** agent 运行时需要的上下文：`root` 与 `resources` 与 setupInstance 时注入的环境变量一致 */
export type AgentSetupContext = {
  root: string
  /** resource 目录，相对 root */
  resources: string[]
  /** agent 连接超时（毫秒），负数表示不设置 */
  timeout: number
  /**
   * 连接成功后的 client 超时（毫秒）。省略时使用 MAX_SAFE_INTEGER（沿用正式实例行为）；
   * 一次性识别工具应给有限值，避免 agent 假死时 native send_and_recv 永久阻塞。
   */
  callTimeout?: number
}

const events = new EventEmitter<{
  agentStopped: [id: string]
}>()

/**
 * 宿主通知过的已结束 agent。
 * `Client.alive` 只探测 ZMQ 发送就绪，对端子进程被 kill 后可能仍为 true；
 * 一次性识别会话需要用它判断缓存的 agent 是否已不可用。
 */
const stoppedAgents = new Set<string>()
const MAX_STOPPED_AGENTS = 256

/** 宿主通知 agent 子进程/调试会话已结束 */
export function notifyAgentStopped(id: string) {
  if (stoppedAgents.size >= MAX_STOPPED_AGENTS) {
    const oldest = stoppedAgents.values().next().value
    if (oldest !== undefined) {
      stoppedAgents.delete(oldest)
    }
  }
  stoppedAgents.add(id)
  events.emit('agentStopped', id)
}

/** 宿主是否已经通知过该 agent 结束 */
export function isAgentStopped(id: string) {
  return stoppedAgents.has(id)
}

/**
 * 已连接、尚未销毁的 agent。同名 identifier 重复启动会互相抢占，
 * 一次性识别工具启动 agent 前需要确认没有正式实例占用同一 identifier。
 */
const liveAgents = new Set<AgentInfo>()

export function isAgentIdentifierInUse(identifier: string) {
  for (const info of liveAgents) {
    if (info.identifier === identifier) {
      return true
    }
  }
  return false
}

/**
 * connect 是 binding 的 AsyncWork，仍在 native 线程里执行时销毁 client 会 use-after-free。
 * 这里记录还没 settle 的清理动作，Resource 的销毁必须等它们结束后再做。
 */
const pendingClientCleanup = new Set<Promise<void>>()

function trackClientCleanup(promise: Promise<unknown>) {
  const tracked = promise.then(
    () => {},
    () => {}
  )
  pendingClientCleanup.add(tracked)
  void tracked.finally(() => {
    pendingClientCleanup.delete(tracked)
  })
}

/**
 * 销毁 Resource 前调用：若仍有 pending 的 agent client 清理，推迟到它们 settle 后销毁，
 * 避免 Resource 先于 Client 销毁（binding 只保存裸指针）。
 */
export function destroyResourceAfterAgentCleanup(resource: maa.Resource) {
  if (pendingClientCleanup.size === 0) {
    resource.destroy()
    return
  }
  logger.info('delay resource destroy until pending agent clients settle')
  void Promise.allSettled([...pendingClientCleanup]).then(() => {
    try {
      resource.destroy()
    } catch (err) {
      logger.warn(`delayed resource destroy failed: ${err}`)
    }
  })
}

// 清理路径不参与控制流：ipc.stopAgent 是 JSON-RPC 请求，对端 handler 的异步拒绝会以
// ResponseError 弹回本进程，不接住就会变成进程级未捕获拒绝（崩溃日志里的裸栈即由此产生）。
export function stopAgentSilently(id: string) {
  ipc.stopAgent(id).catch(err => {
    logger.warn(`stopAgent ${id} failed: ${err}`)
  })
}

/** 销毁 agent：先销毁 native client 句柄，再通知宿主结束子进程（不做 disconnect 握手） */
export function destroyAgent(agent: AgentInfo) {
  liveAgents.delete(agent)
  try {
    agent.client.destroy()
  } catch {
    // 句柄已失效时忽略
  }
  stopAgentSilently(agent.agent)
}

/**
 * 启动并连接一个 agent，返回绑定好 resource 的 client。
 * 失败返回 null；连接失败时按现有约定等 connect settle 后再销毁 client。
 */
export async function startAgent(
  agentConfig: AgentRuntime,
  context: AgentSetupContext,
  resource: maa.Resource
): Promise<AgentInfo | null> {
  const client = new maa.Client(agentConfig.identifier)
  const identifier = client.identifier ?? 'vsc-no-identifier'

  logger.info(`AgentClient listening ${identifier}`)

  let agent: string | undefined = undefined
  const env = {
    VSCODE_MAAFW_AGENT: '1',
    VSCODE_MAAFW_AGENT_ROOT: context.root,
    VSCODE_MAAFW_AGENT_RESOURCE: context.resources
      .map(p => path.resolve(context.root, p))
      .join(path.delimiter)
  }
  if (agentConfig.debug_session) {
    const handle = await ipc.startDebugSession(agentConfig.debug_session, identifier, env)
    if (!handle) {
      client.destroy()
      return null
    }
    agent = handle
  } else if (agentConfig.child_exec) {
    const handle = await ipc.startTask(
      agentConfig.child_exec,
      (agentConfig.child_args ?? []).concat([identifier]),
      context.root,
      env
    )
    if (!handle) {
      client.destroy()
      return null
    }
    agent = handle
  } else {
    return null
  }

  const [agentStopPromise, agentStopResolve] = makePromise<void>()
  const watcher = (id: string) => {
    if (id !== agent) {
      return
    }
    agentStopResolve()
  }
  events.on('agentStopped', watcher)

  if (context.timeout >= 0) {
    client.timeout = context.timeout.toString()
  }
  client.bind_resource(resource)
  logger.info(`AgentClient start connecting ${identifier}`)

  const connectPromise = client.connect()

  const succ = await Promise.race([
    connectPromise.then(() => true),
    agentStopPromise.then(() => false)
  ])

  logger.info(`agent start race result ${succ}`)
  events.off('agentStopped', watcher)

  if (!succ) {
    logger.info(`AgentClient connect failed`)
    // 宿主已通知 agent 结束，但 connect 可能仍在 native 线程执行；等它 settle 再清理，
    // 且 resolve / reject 都要清理（reject 时 then 不执行会漏掉 client）
    trackClientCleanup(
      connectPromise
        .then(() => {})
        .catch(() => {})
        .finally(() => {
          try {
            client?.destroy()
          } catch {
            // 句柄已失效时忽略
          }
          if (agent) {
            stopAgentSilently(agent)
          }
        })
    )
    return null
  }

  if (!(client.connected && client.alive)) {
    logger.info(`AgentClient connect failed`)
    client?.destroy()
    if (agent) {
      stopAgentSilently(agent)
    }
    return null
  } else {
    logger.info(`AgentClient connect succeeded`)
  }
  if (context.timeout >= 0) {
    client.timeout = (context.callTimeout ?? Number.MAX_SAFE_INTEGER).toString()
  }
  const info: AgentInfo = {
    agent,
    client,
    identifier: agentConfig.identifier
  }
  liveAgents.add(info)
  return info
}
