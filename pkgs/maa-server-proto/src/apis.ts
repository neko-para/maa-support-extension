import type {
  AgentRuntime,
  ControllerRuntime,
  InterfaceRuntime
} from '@nekosu/maa-pipeline-manager'
import type { ColorMatchOptions } from '@nekosu/maa-types'

type MarkReturnPromise<Func> = Func extends (...args: infer Args) => infer Ret
  ? (...args: Args) => Promise<Awaited<Ret> | null>
  : Func

/**
 * interface 项目里与 agent 有关的信息，一次性识别工具需要它来启动 Custom 识别所需的 agent。
 * 路径以 `root` 为基准，与 `setupInstance` 时传给 agent 子进程的环境变量保持一致。
 */
export type ToolAgentSetup = {
  /** interface 项目根目录 */
  root: string
  /** resource 目录，相对 root */
  resources: string[]
  /** interface 声明的 agent */
  agents: AgentRuntime[]
  /** agent 连接超时（毫秒） */
  timeout: number
}

/**
 * 一次性识别工具的内部失败标签。
 * 标签由协议固定，宿主负责映射成各语言文案；新增标签时宿主的映射表必须同步（类型检查兜底）。
 */
export type ToolInternalTag =
  | 'no-resource'
  | 'ipc'
  | 'resource-load-failed'
  | 'controller-create-failed'
  | 'tasker-create-failed'
  | 'scan-failed'
  | 'invalid-options'
  | 'custom-recognition-failed'
  | 'internal-error'

/** 一次性识别工具的失败原因，由宿主转换成用户可读文案 */
export type ToolFailure =
  | { kind: 'no-agent'; names: string[] }
  | { kind: 'unregistered'; names: string[] }
  | { kind: 'agent-exited'; names: string[] }
  | { kind: 'agent-start-failed'; target: string }
  | { kind: 'busy' }
  | { kind: 'internal'; tag: ToolInternalTag; detail?: string }

/** 一次性识别工具的返回 */
export type ToolResult = {
  /** 识别详情 JSON；失败时为 null，识别未命中时也可能有值（hit: false） */
  detail: string | null
  failure?: ToolFailure
}

export type HostToSubApis = {
  fetchConstants: () => unknown
  updateController: (runtime: ControllerRuntime) => boolean
  setupInstance: (
    runtime: InterfaceRuntime,
    timeout: number
  ) => {
    handle?: string
    error?: string
  }
  getScreencap: (inst?: string) => string | null
  resize: (image: string, width: number, height: number) => string
  performOcr: (
    isMaa: boolean,
    image: string,
    opts: { roi: maa.Rect; only_rec: boolean },
    resources: string[]
  ) => string
  performTemplateMatch: (
    image: string,
    targetImage: string,
    opts: {
      roi: maa.Rect
      method: 10001 | 3 | 5
      threshold: number
      green_mask: boolean
    }
  ) => string
  /**
   * 对给定图像运行一次节点识别。`agent` 非空时，会按需启动 interface agent
   * 以支持节点里的 Custom 识别；会话在空闲后释放。
   */
  performReco: (image: string, resources: string[], agent?: ToolAgentSetup) => ToolResult
  /** 对给定图像运行一次 ColorMatch 识别 */
  performColorMatch: (image: string, options: ColorMatchOptions) => ToolResult
  /** 释放 performReco 缓存的 agent 会话 */
  releaseRecoSession: () => void

  refreshAdb: (adbPath?: string) => maa.AdbDevice[]
  refreshDesktop: () => maa.DesktopDevice[]
  refreshGamescope: () => maa.GamescopeInstance[]
  refreshWlrCompositor: () => maa.WlRootsCompositor[]

  postTask: (inst: string, task: string, pipeline_override: Record<string, unknown>[]) => boolean
  postStop: (inst: string) => void
  getKnownTasks: (inst: string) => string[]
  destroyInstance: (inst: string) => void

  getRecoDetail: (
    inst: string,
    reco_id: maa.RecoId
  ) => { info: maa.RecoDetailWithoutDraws; raw: string; draws: string[] }
  getActDetail: (inst: string, act_id: maa.ActId) => maa.ActionDetail
  getNode: (inst: string, task: string) => string

  agentStopped: (id: string) => void
}

export type SubToHostApis = {
  pushNotify: (inst: string, msg: unknown) => void

  startTask: (exec: string, args: string[], cwd: string, env: Record<string, string>) => string
  startDebugSession: (
    name: string,
    identifier: string,
    env: Record<string, string>
  ) => string | null
  stopAgent: (id: string) => void

  quickPick: (items: string[]) => string | null
}

export type MarkApisImpl<T> = {
  [K in keyof T]: MarkReturnPromise<T[K]>
}

export type MarkApis<Server, Client> = MarkApisImpl<Server> &
  Readonly<MarkApisImpl<Client>> & {
    $: Record<string, (...args: unknown[]) => unknown>
  }
