import type { LocaleType } from '@nekosu/maa-locale'
import type { DiagnosticType, ParserConfig } from '@nekosu/maa-pipeline-manager'
import type { NpmRegistryType } from '@nekosu/maa-version-manager'

export type BaseConfig = {
  cwd?: string
  mode?: 'stdio' | 'github' | 'json'
  repo?: string
  locale?: LocaleType

  maaVersion?: string
  maaCache?: string
  maaMirror?: NpmRegistryType
  // from @maaxyz/maa-node
  maaStdoutLevel?: 'Off' | 'Fatal' | 'Error' | 'Warn' | 'Info' | 'Debug' | 'Trace' | 'All'
  maaLogDir?: string

  // color?: 'auto' | 'enable' | 'disable'

  interfacePath: string

  parser?: ParserConfig
}

export type CheckConfig = {
  /** Maximum number of controller/resource path sets checked concurrently. */
  job?: number
  override?: Partial<Record<DiagnosticType, 'ignore' | 'warning' | 'error'>>
}

export type CaseOrigin = {
  /** 来源测试文件的绝对路径。 */
  file: string
  /** 原始文件 cases 数组中的下标，不随展开或过滤改变。 */
  case: number
}

export type TestCases = {
  /** 本组完整的待检查节点，展开时在用例过滤前固定。 */
  nodes?: string[]
  configs: {
    name?: string
    resource: string
    controller: string
    imageRoot?: string
  }
  cases: {
    name?: string
    origin: CaseOrigin
    image: string
    hits: (
      | string
      | {
          node: string
          box: maa.Rect
        }
    )[]
  }[]
}

/**
 * 识别测试期间启动的 AgentServer 子进程，字段与 interface.json 的 agent 声明一致。
 * 显式配置的相对路径以 cwd 解析；从 interface 读取时以 interface.json 所在目录解析。
 */
export type TestAgentConfig = {
  child_exec: string
  child_args?: string[]
  /** 连接标识符前缀；实际会追加 worker/进程后缀保证唯一 */
  identifier?: string
  /** 子进程工作目录，相对 cwd；默认与 child_exec 的解析根一致 */
  cwd?: string
  /** 在继承的进程环境和 PI 变量之上追加的环境变量 */
  env?: Record<string, string>
  /** 连接 AgentServer 的超时，默认 30000ms */
  connectTimeoutMs?: number
  /** 工具侧 watchdog 的单次等待上限（不是 MaaFW IPC 超时）；0 或省略=60s，小于 1s 按 1s 计，超时按 test-agent-failed 上报 */
  timeoutMs?: number
}

/**
 * `'interface'`（默认）读取 interface.json 顶层 agent 声明；`false` 关闭；
 * 对象或数组显式声明并覆盖 interface。
 */
export type TestAgentSetting = 'interface' | false | TestAgentConfig | TestAgentConfig[]

export type TestConfig = {
  casesCwd?: string
  cases: TestCases[] | (() => Promise<TestCases[]>)
  errorDetailsPath?: string

  /** 识别日志保留最近几轮（maa-tools-run-<n> 目录），默认 10，至少 1 */
  maaLogKeep?: number

  job?: number
  maxNodePerJob?: number

  /** Custom 识别的 AgentServer；默认读取 interface.json，只在待测节点确实用到 Custom 识别时启动 */
  agent?: TestAgentSetting
}

export type VscodeConfig = {
  agents?: Record<string, string>
}

export type FullConfig = BaseConfig & {
  check?: CheckConfig
  test?: TestConfig
  vscode?: VscodeConfig
}
