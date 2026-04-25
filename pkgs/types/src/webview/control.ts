import type { Interface, InterfaceConfig, OptionTrace } from '@nekosu/maa-pipeline-manager'

import type { HostStateBase } from './base'

export type EvalTaskConfig = {
  expandList?: boolean
  stripList?: boolean // default true
}

export type ControlHostState = HostStateBase & {
  admin?: boolean

  interface?: string[]
  activeInterface?: string
  refreshingInterface?: boolean

  interfaceConfigJson?: InterfaceConfig

  evalTaskConfig?: EvalTaskConfig
}

export type ControlHostToWeb =
  | {
      command: 'updateState'
      state: ControlHostState
    }
  | {
      command: 'updateInterface'
      interfaceJson: Interface
    }

export type NativeSelectOption = {
  value: string | number
  title: string
  desc?: string
  subtitle?: string
}
export type ToolkitJumpTarget =
  | 'maa-log'
  | 'ext-log'
  | 'crop-tool'
  | 'switch-maa-ver'
  | 'switch-admin'

export type InterfaceRevealOption =
  | {
      type: 'entry'
      entry: string
      task: string
    }
  | {
      type: 'controller'
      ctrl: string
    }
  | {
      type: 'resource'
      res: string
    }
  | {
      type: 'task'
      task: string
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
  | {
      type: 'option_ref'
      trace: OptionTrace
    }

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
      name: string
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
      type: 'win32' | 'gamepad'
      handle: maa.DesktopHandle
    }
  | {
      command: 'configPlayCover'
      address: string
    }
  | {
      command: 'configDesktopWlRoots'
      socket_path: string
    }
  | {
      command: 'uploadImage'
    }
  | {
      command: 'usePreset'
      preset: string
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
      value: undefined | string | string[] | Record<string, string>
    }
  | {
      command: 'revealInterface'
      dest?: InterfaceRevealOption
    }
  | {
      command: 'launch'
    }
  | {
      // return string
      command: 'translate'
      key: string
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
