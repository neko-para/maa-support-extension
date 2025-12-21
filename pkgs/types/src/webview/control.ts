import type { Interface, InterfaceConfig } from '../pi'
import type { HostStateBase } from './base'

export type EvalTaskConfig = {
  expandList?: boolean
  stripList?: boolean // default true
}

export type ControlHostState = HostStateBase & {
  interface?: string[]
  activeInterface?: string
  refreshingInterface?: boolean

  interfaceJson?: Partial<Interface>
  interfaceConfigJson?: Partial<InterfaceConfig>

  evalTaskConfig?: EvalTaskConfig
}

export type ControlHostToWeb = {
  command: 'updateState'
  state: ControlHostState
}

export type NativeSelectOption = {
  value: string | number
  title: string
  subtitle?: string
}
export type ToolkitJumpTarget = 'maa-log' | 'ext-log' | 'crop-tool' | 'switch-maa-ver'

export type ControlWebToHost =
  | {
      // return string | number | null
      command: 'showSelect'
      options: NativeSelectOption[]
    }
  | {
      // return null
      command: 'toolkitJump'
      target: ToolkitJumpTarget
    }
  | {
      command: 'refreshInterface'
    }
  | {
      command: 'selectInterface'
      path: string
    }
  | {
      command: 'revealConfig'
    }
  | {
      command: 'selectResource'
      index: number
    }
  | {
      command: 'selectController'
      index: number
    }
  | {
      // return [name: string, adb_path: string, address: string, screencap_methods: maa.Uint64, input_methods: maa.Uint64, config: string][] | null
      command: 'refreshAdb'
    }
  | {
      // return [handle: string, class_name: string, window_name: string][] | null
      command: 'refreshDesktop'
    }
  | {
      command: 'configAdb'
      adb: string
      address: string
      screencap: maa.ScreencapOrInputMethods
      input: maa.ScreencapOrInputMethods
      config: string
    }
  | {
      command: 'configDesktop'
      handle: maa.DesktopHandle
    }
  | {
      command: 'uploadImage'
    }
  | {
      command: 'addTask'
      task: string
    }
  | {
      command: 'removeTask'
      key: string
    }
  | {
      command: 'configTask'
      key: string
      option: string
      name: string
      value?: string
    }
  | {
      command: 'revealInterface'
      dest:
        | {
            type: 'entry'
            entry: string
          }
        | {
            type: 'option'
            option: string
          }
        | {
            type: 'case'
            option: string
            case: string
          }
        | {
            type: 'input'
            option: string
            name: string
          }
    }
  | {
      command: 'launch'
    }
  | {
      command: 'maa.evalTask'
      task: string
    }
  | {
      command: 'maa.evalExpr'
      expr: string
      host: string
    }
  | {
      command: 'maa.updateEvalConfig'
      config: EvalTaskConfig
    }
