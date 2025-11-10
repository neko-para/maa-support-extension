import type { InterfaceV2 } from './pi_v2'

export type InterfaceV1 = {
  controller: {
    name: string
    type: 'Adb' | 'Win32' | 'VscFixed'
    adb?: {
      screencap?: maa.ScreencapOrInputMethods
      input?: maa.ScreencapOrInputMethods
      config?: unknown
    }
    win32?: {
      class_regex?: string
      window_regex?: string
      screencap?: maa.ScreencapOrInputMethods
      input?: maa.ScreencapOrInputMethods
    }
  }[]
  resource: {
    name: string
    path: string | string[]
  }[]
  task: {
    name: string
    entry: string
    pipeline_override?: unknown
    option?: string[]
  }[]
  option?: Record<
    string,
    {
      cases: {
        name: string
        pipeline_override?: unknown
      }[]
      default_case?: string
    }
  >
  version?: string
  message?: string
  agent?: {
    child_exec?: string
    child_args?: string[]
    identifier?: string
  }
  interface_version?: never
}

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
    name: string
  }
  adb?: {
    adb_path: string
    address: string
    config: unknown
  }
  win32?: {
    hwnd?: maa.DesktopHandle | null
  }
  vscFixed?: {
    image?: string
  }
  resource: string
  task: TaskConfig[]
  // gpu?: number
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
        ctype: 'vscFixed'
        image: string
      }
  ) & {
    display_short_side?: number
    display_long_side?: number
    display_raw?: boolean
  }
  resource_path: string[]
  task: {
    name: string
    entry: string
    pipeline_override: unknown[]
  }[]
  // gpu: number
  agent?: {
    child_exec?: string
    child_args?: string[]
    identifier?: string
  }
}

export type Interface = InterfaceV2
