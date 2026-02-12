import type { InterfaceV2 } from './pi_v2'

export type TaskConfig = {
  name: string
  option?: {
    [option in string]?: {
      [sub in string]?: string
    }
  }

  __vscKey?: string
  __vscExpand?: boolean
}

export type InterfaceConfig = {
  controller: {
    // `$fixed`
    name: string
  }
  adb?: {
    adb_path: string
    address: string
    screencap: maa.ScreencapOrInputMethods
    input: maa.ScreencapOrInputMethods
    config: unknown
  }
  win32?: {
    hwnd?: maa.DesktopHandle | null
  }
  playcover?: {
    address: string
  }
  gamepad?: {
    hwnd?: maa.DesktopHandle | null
  }
  vscFixed?: {
    image?: string
  }
  resource: string
  task: TaskConfig[]
  // gpu?: number

  locale?: string
}

export type InterfaceAgentRuntime = {
  child_exec?: string
  child_args?: string[]
  identifier?: string
  debug_session?: string
}

export type InterfaceRuntime = {
  root: string
  controller_param: (
    | {
        ctype: 'adb'
        adb_path: string
        address: string
        screencap: maa.ScreencapOrInputMethods
        input: maa.ScreencapOrInputMethods
        config: string
      }
    | {
        ctype: 'win32'
        hwnd: maa.DesktopHandle
        screencap: maa.ScreencapOrInputMethods
        mouse: maa.ScreencapOrInputMethods
        keyboard: maa.ScreencapOrInputMethods
      }
    | {
        ctype: 'playcover'
        address: string
        uuid: string
      }
    | {
        ctype: 'gamepad'
        hwnd: maa.DesktopHandle
        screencap: maa.ScreencapOrInputMethods
        gamepad: maa.Uint64
      }
    | {
        ctype: 'vscFixed'
        image: string
      }
  ) & {
    display_short_side?: number
    display_long_side?: number
    display_raw?: boolean
    permission_required?: boolean
    attach_resource_path?: string[]
  }
  resource_path: string[]
  task: {
    name: string
    entry: string
    pipeline_override: unknown[]
  }[]
  // gpu: number
  agent: InterfaceAgentRuntime[]
}

export type Interface = InterfaceV2
