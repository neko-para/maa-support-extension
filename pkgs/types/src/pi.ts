import type * as maa from '@maaxyz/maa-node'

export type Interface = {
  controller: {
    name: string
    type: 'Adb' | 'Win32' | 'VscFixed'
    adb?: {
      screencap?: maa.api.ScreencapOrInputMethods
      input?: maa.api.ScreencapOrInputMethods
      config?: unknown
    }
    win32?: {
      class_regex?: string
      window_regex?: string
      screencap?: maa.api.ScreencapOrInputMethods
      input?: maa.api.ScreencapOrInputMethods
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
    name: string
    value: string
  }[]

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
    hwnd?: maa.api.DesktopHandle | null
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
  controller_param:
    | {
        ctype: 'adb'
        adb_path: string
        address: string
        screencap: maa.api.ScreencapOrInputMethods
        input: maa.api.ScreencapOrInputMethods
        config: string
      }
    | {
        ctype: 'win32'
        hwnd: maa.api.DesktopHandle
        screencap: maa.api.ScreencapOrInputMethods
        input: maa.api.ScreencapOrInputMethods
      }
    | {
        ctype: 'vscFixed'
        image: string
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
