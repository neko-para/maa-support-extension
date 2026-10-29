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

export type TestConfig = {
  casesCwd?: string
  cases: TestCases[] | (() => Promise<TestCases[]>)
  errorDetailsPath?: string

  /** 识别日志保留最近几轮（maa-tools-run-<n> 目录），默认 10，至少 1 */
  maaLogKeep?: number

  job?: number
  maxNodePerJob?: number
}

export type VscodeConfig = {
  agents?: Record<string, string>
}

export type FullConfig = BaseConfig & {
  check?: CheckConfig
  test?: TestConfig
  vscode?: VscodeConfig
}
