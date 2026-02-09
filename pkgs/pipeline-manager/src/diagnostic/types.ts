import type { AbsolutePath } from '../utils/types'

export type DiagnosticPosition = {
  file: AbsolutePath
  offset: number
  length: number
}

export type DiagnosticBase = DiagnosticPosition & {
  level: 'warning' | 'error'
}

export type DiagnosticTask =
  | {
      type: 'conflict-task'
      task: string
      previous: DiagnosticPosition
    }
  | {
      type: 'duplicate-next'
      task: string
    }
  | {
      type: 'unknown-task'
      task: string
    }
  | {
      type: 'dynamic-image'
    }
  | {
      type: 'image-path-back-slash'
    }
  | {
      type: 'image-path-dot-slash'
    }
  | {
      type: 'image-path-missing-png' // maa only
    }
  | {
      type: 'unknown-image'
      image: string
    }
  | {
      type: 'unknown-anchor'
      anchor: string
    }
  | {
      type: 'unknown-attr'
      attr: string
    }
  | {
      type: 'unknown-locale'
      locale: string
    }
  | {
      type: 'missing-locale'
      locale: string
      langs: string[]
    }
  | {
      type: 'mpe-config'
    }

export type DiagnosticInterface =
  | {
      type: 'int-conflict-controller'
      ctrl: string
      previous: DiagnosticPosition
    }
  | {
      type: 'int-unknown-controller'
      ctrl: string
    }
  | {
      type: 'int-conflict-resource'
      res: string
      previous: DiagnosticPosition
    }
  | {
      type: 'int-unknown-resource'
      res: string
    }
  | {
      type: 'int-conflict-option'
      option: string
      previous: DiagnosticPosition
    }
  | {
      type: 'int-unknown-option'
      option: string
    }
  | {
      type: 'int-conflict-case'
      option: string
      case: string
      previous: DiagnosticPosition
    }
  | {
      type: 'int-unknown-case'
      option: string
      case: string
    }
  | {
      type: 'int-switch-name-invalid'
    }
  | {
      type: 'int-switch-missing'
      option: string
      missingYes: boolean
      missingNo: boolean
    }
  | {
      type: 'int-switch-should-fixed'
    }
  | {
      type: 'int-unknown-entry-task'
      task: string
    }
  | {
      type: 'int-override-unknown-task'
      task: string
    }

export type Diagnostic = DiagnosticBase & (DiagnosticTask | DiagnosticInterface)

export type DiagnosticType = Diagnostic['type']

export type DiagnosticOption = {
  ignoreTypes?: DiagnosticType[]
  errorTypes?: DiagnosticType[]
}
