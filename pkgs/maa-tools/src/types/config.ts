import type { LocaleType } from '@nekosu/maa-locale'
import type { DiagnosticType } from '@nekosu/maa-pipeline-manager'

export type BaseConfig = {
  cwd?: string
  mode?: 'stdio' | 'github' | 'json'
  repo?: string
  locale?: LocaleType

  maaVersion?: string
  maaCache?: string
  // from @maaxyz/maa-node
  maaStdoutLevel?: 'Off' | 'Fatal' | 'Error' | 'Warn' | 'Info' | 'Debug' | 'Trace' | 'All'

  // color?: 'auto' | 'enable' | 'disable'
}

export type CheckConfig = {
  interfacePath: string

  override?: Partial<Record<DiagnosticType, 'ignore' | 'warning' | 'error'>>
}

export type TestCases = {
  configs: {
    name?: string
    resource: string
    controller: string
    imageRoot?: string
  }
  cases: {
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
  interfacePath: string
  casesCwd?: string
  cases: TestCases[] | (() => Promise<TestCases[]>)

  job?: number
  maxNodePerJob?: number
}

export type FullConfig = BaseConfig & {
  check?: CheckConfig
  test?: TestConfig
}
