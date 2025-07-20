import type * as maa from '@maaxyz/maa-node'

import type { Interface, InterfaceConfig } from '../pi'
import type { HostStateBase } from './base'

export type ControlHostState = HostStateBase & {
  interface?: string[]
  activeInterface?: string
  refreshingInterface?: boolean

  interfaceJson?: Partial<Interface>
  interfaceConfigJson?: Partial<InterfaceConfig>
}

export type ControlHostToWeb = {
  command: 'updateState'
  state: ControlHostState
}

export type ControlWebToHost =
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
      config: string
    }
  | {
      command: 'configDesktop'
      handle: maa.api.DesktopHandle
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
      value: string
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
    }
  | {
      command: 'launch'
    }
