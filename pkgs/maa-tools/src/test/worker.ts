import { type ChildProcess, spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as workerpool from 'workerpool'

import { loadMaa, makeFakeController, toArrayBuffer } from '../utils/maa'
import {
  AGENTS_ENV,
  type CustomRecognitionRequirement,
  PLANNED_NODES_ENV,
  type ResolvedAgentConfig,
  formatMissingAgentError,
  formatUnregisteredAgentError,
  requiredCustomRecognitions
} from './agents'
import type { PrepareOutcome, RecoJob, RecoJobOutcome, RecoResult } from './types'

await loadMaa(
  process.env.MAAFW_MODULE_PATH,
  path.join(process.env.MAAFW_LOG_DIR, `maa-${process.env.MAATOOLS_POOL_ID}-${process.pid}`)
)

const stdoutLevels = ['Off', 'Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Trace', 'All'] as const
type MaaStdoutLevel = (typeof stdoutLevels)[number]
if (
  process.env.MAAFW_STDOUT_LEVEL &&
  stdoutLevels.includes(process.env.MAAFW_STDOUT_LEVEL as MaaStdoutLevel)
) {
  maa.Global.stdout_level = process.env.MAAFW_STDOUT_LEVEL as MaaStdoutLevel
}

type RunningAgent = {
  client: maa.Client
  child: ChildProcess
  label: string
  logPath: string
}

/** agent 生命周期错误；与框架/资源准备错误分开上报。 */
class AgentSetupError extends Error {}

let inst: maa.Tasker | undefined = undefined
let setupPromise: Promise<void> | undefined = undefined
let agents: RunningAgent[] = []
const taskQueue: ((ctx: maa.Context) => Promise<void>)[] = []
let taskAddResolve: () => void = () => {}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** 环境变量里传的是父进程序列化后的配置；解析失败说明传参损坏，不能静默当成空配置。 */
function parseEnvJson<T>(key: string): T | undefined {
  const raw = process.env[key]
  if (raw === undefined || raw === '') {
    return undefined
  }
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new Error(`环境变量 ${key} 解析失败：${errorMessage(error)}`)
  }
}

function agentLogPath(index: number) {
  return path.join(
    process.env.MAAFW_LOG_DIR,
    `agent-${process.env.MAATOOLS_POOL_ID}-${process.pid}-${index}.log`
  )
}

/** 强杀 worker 时 onTerminate 不会执行，父进程靠这份 pid 文件回收残留 agent。 */
function agentPidPath() {
  return path.join(process.env.MAAFW_LOG_DIR, `agent-pids-${process.pid}.json`)
}

function writeAgentPids() {
  const pids = agents.map(agent => agent.child.pid).filter((pid): pid is number => !!pid)
  try {
    fs.writeFileSync(agentPidPath(), JSON.stringify(pids))
  } catch {
    // pid 文件只用于强杀兜底，写失败不影响测试。
  }
}

function buildIdentifier(declared: string | undefined, index: number) {
  const suffix = `${process.pid}-${process.env.MAATOOLS_POOL_ID}-${index}-${Date.now().toString(36)}`
  return declared ? `${declared}-${suffix}` : `maa-tools-${suffix}`
}

/**
 * agent 进程的实际环境：继承 worker 进程环境，但不透传工具自己的 agent/节点配置变量，
 * 避免把一个 agent 的 env（可能含密钥）泄漏给另一个 agent。
 */
function agentSpawnEnv(config: ResolvedAgentConfig) {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env[AGENTS_ENV]
  delete env[PLANNED_NODES_ENV]
  return { ...env, ...config.env }
}

async function spawnAgent(config: ResolvedAgentConfig, identifier: string, logPath: string) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  let fd: number | undefined = undefined
  let child: ChildProcess
  try {
    fd = fs.openSync(logPath, 'a')
    child = spawn(config.childExec, [...config.childArgs, identifier], {
      cwd: config.cwd,
      env: agentSpawnEnv(config),
      stdio: ['ignore', fd, fd],
      windowsHide: true
    })
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        // 关闭失败不影响启动错误本身。
      }
    }
    throw new AgentSetupError(`无法启动 agent ${config.childExec}：${errorMessage(error)}`)
  }
  try {
    fs.closeSync(fd)
  } catch {
    // child 已继承 fd，父进程关闭失败不影响运行。
  }
  await new Promise<void>((resolve, reject) => {
    child.once('spawn', () => resolve())
    child.once('error', error =>
      reject(
        new AgentSetupError(
          `无法启动 agent ${config.childExec}：${errorMessage(error)}（是否还没有构建 agent？）`
        )
      )
    )
  })
  // 启动后仍可能异步报错（例如管道断开），不能让未处理的 error 事件打崩 worker。
  child.on('error', () => {})
  return child
}

/**
 * 连接超时必须交给 native 侧：Node binding 的 connect 是 AsyncWork，JS 侧计时后
 * destroy 会与仍在执行的握手并发（use-after-free）。设好 timeout 后等待 connect
 * 自己 settle，清理只在 settle 之后进行。
 */
async function connectAgent(client: maa.Client, config: ResolvedAgentConfig) {
  client.timeout = String(config.connectTimeoutMs)
  await client.connect()
  if (!client.connected || !client.alive) {
    throw new AgentSetupError('连接后 agent 不可用')
  }
  // 不在 native 侧设识别超时：MaaFW 超时会被记成"未命中"，由调用方 watchdog 统一判成
  // agent 无响应。timeoutMs 只用于计算 watchdog。
  client.timeout = String(Number.MAX_SAFE_INTEGER)
}

function describeAgentFailure() {
  for (const agent of agents) {
    try {
      if (agent.child.exitCode !== null || agent.child.signalCode !== null || !agent.client.alive) {
        return `agent 进程已退出或已失联：${agent.label}；日志：${agent.logPath}`
      }
    } catch {
      return `agent 状态不可用：${agent.label}；日志：${agent.logPath}`
    }
  }
  return undefined
}

async function startAgents(
  res: maa.Resource,
  requirements: readonly CustomRecognitionRequirement[]
) {
  const configs = parseEnvJson<ResolvedAgentConfig[]>(AGENTS_ENV) ?? []
  if (configs.length === 0) {
    throw new AgentSetupError(formatMissingAgentError(requirements))
  }

  try {
    for (const [index, config] of configs.entries()) {
      const logPath = agentLogPath(index)
      // Node binding 在 Windows 上可能从 IPC 降级到 TCP，identifier 会被换成端口号，
      // 必须回读实际值再交给子进程，否则永远连不上。
      const client = new maa.Client(buildIdentifier(config.identifier, index))
      const identifier = client.identifier
      let child: ChildProcess | undefined = undefined
      try {
        child = await spawnAgent(config, identifier, logPath)
        client.bind_resource(res)
        await connectAgent(client, config)
      } catch (error) {
        child?.kill()
        // 不做 disconnect 握手：被 kill 的 agent 可能让 send_and_recv 永久等待。
        try {
          client.destroy()
        } catch {
          // 句柄已失效时忽略，不覆盖原始错误。
        }
        const message = error instanceof AgentSetupError ? error.message : errorMessage(error)
        throw new AgentSetupError(
          `agent 初始化失败：${config.childExec}（${message}）；日志：${logPath}`
        )
      }
      agents.push({ client, child, label: config.childExec, logPath })
      // 每启动一个就落盘：watchdog 可能在后续连接期间强杀 worker，晚写会漏掉已 spawn 的 agent。
      writeAgentPids()
    }
  } catch (error) {
    stopAgents()
    throw error
  }

  const registered = new Set(agents.flatMap(agent => agent.client.custom_recognition_list ?? []))
  const missing = requirements.filter(item => !registered.has(item.name))
  if (missing.length > 0) {
    throw new AgentSetupError(formatUnregisteredAgentError(missing))
  }
}

/**
 * 清理 agent：先全部 kill，再只 destroy（不做关闭握手）。
 * agent 被 kill 后 ZMQ 尚未感知对端消失，disconnect 的 send_and_recv 可能永久等待；
 * 只要有一个卡住，后续 agent 的 kill 也不会执行，最终留下孤儿进程。
 */
function stopAgents() {
  const running = agents
  agents = []
  for (const agent of running) {
    try {
      agent.child.kill()
    } catch {
      // 进程已退出时忽略。
    }
  }
  for (const agent of running) {
    try {
      agent.client.destroy()
    } catch {
      // 句柄已失效时忽略。
    }
  }
  try {
    fs.rmSync(agentPidPath(), { force: true })
  } catch {
    // 清理失败不覆盖调用方错误。
  }
}

async function setup() {
  const ctrl = await makeFakeController()
  const res = new maa.Resource()
  for (const full of process.env.MAAFW_RESOURCE_PATHS.split(path.delimiter)) {
    await res.post_bundle(full).wait()
  }
  inst = new maa.Tasker()
  inst.resource = res
  inst.controller = ctrl

  res.register_custom_action('@mse/action', async self => {
    while (true) {
      while (taskQueue.length > 0) {
        const task = taskQueue.shift()!
        await task(self.context)
      }
      await new Promise<void>(resolve => {
        taskAddResolve = resolve
      })
      if (taskQueue.length === 0) {
        break
      }
    }
    return true
  })

  inst!.post_task('@mse/action', {
    '@mse/action': {
      action: 'Custom',
      custom_action: '@mse/action'
    }
  })

  const nodes = parseEnvJson<string[]>(PLANNED_NODES_ENV) ?? []
  const unreadable: string[] = []
  const requirements = requiredCustomRecognitions(nodes, node => {
    const data = res.get_node_data(node)
    if (!data) {
      unreadable.push(node)
    }
    return data
  })
  if (unreadable.length > 0) {
    console.error(`无法读取待测节点定义（节点不存在或资源未加载）：${unreadable.join(', ')}`)
  }
  if (requirements.length > 0) {
    await startAgents(res, requirements)
  }
}

function ensureSetup() {
  setupPromise ??= setup()
  return setupPromise
}

async function prepare(): Promise<PrepareOutcome> {
  try {
    await ensureSetup()
    return { ok: true, agentsStarted: agents.length > 0 }
  } catch (error) {
    return {
      ok: false,
      kind: error instanceof AgentSetupError ? 'agent' : 'setup',
      error: errorMessage(error)
    }
  }
}

async function performReco(job: RecoJob): Promise<RecoJobOutcome> {
  try {
    await ensureSetup()
  } catch (error) {
    return {
      results: [],
      durationMs: 0,
      error: errorMessage(error),
      errorKind: error instanceof AgentSetupError ? 'agent' : 'setup'
    }
  }

  const before = describeAgentFailure()
  if (before) {
    return { results: [], durationMs: 0, error: before, errorKind: 'agent' }
  }

  // 只累计读图和识别工作，排除 worker 初始化与任务队列中的等待。
  const readStartedAt = performance.now()
  let image: ArrayBuffer
  try {
    image = toArrayBuffer(await fsp.readFile(job.imagePath))
  } catch (error) {
    console.error(error)
    return { results: [], durationMs: performance.now() - readStartedAt }
  }
  let durationMs = performance.now() - readStartedAt
  const results: RecoResult[] = []
  let failure: string | undefined = undefined
  const { promise, resolve } = Promise.withResolvers<void>()

  taskQueue.push(async context => {
    const startedAt = performance.now()
    try {
      for (const node of job.nodes) {
        if (failure) {
          break
        }
        try {
          const detail = await context.run_recognition(node, image)
          results.push({
            imagePath: job.imagePath,
            imagePathRaw: job.imagePathRaw,
            node,
            hit: !!detail?.hit,
            detail,
            pid: process.pid
          })
          // 未命中是 hit:false 的 detail；null 只在节点不可用/调用失败时出现。
          // 无论哪种，调用返回后都复查进程状态，避免把 agent 死亡当成识别未命中。
          if (!detail) {
            failure = describeAgentFailure()
          }
        } catch (error) {
          // 缺失节点由 evaluateCase 记为 no-result，不能让队列等待永不结束。
          console.error(error)
          failure = describeAgentFailure()
        }
      }
    } finally {
      durationMs += performance.now() - startedAt
      resolve()
    }
  })
  taskAddResolve()
  await promise

  if (results.length < job.nodes.length) {
    failure ??= describeAgentFailure()
  }
  return failure
    ? { results, durationMs, error: failure, errorKind: 'agent' }
    : { results, durationMs }
}

workerpool.worker(
  {
    prepare,
    performReco
  },
  {
    onTerminate: () => {
      stopAgents()
      taskAddResolve()
    }
  }
)

process.once('exit', stopAgents)
