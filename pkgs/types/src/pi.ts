import type maa from '@maaxyz/maa-node'

export type Interface = {
  controller: {
    name: string
    type: 'Adb' | 'Win32'
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
    path: string[]
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
  resource: string
  task: {
    name: string
    option?: {
      name: string
      value: string
    }[]
  }[]
  // gpu?: number
}

export type InterfaceRuntime = {
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
  resource_path: string[]
  task: {
    name: string
    entry: string
    pipeline_override: unknown
  }[]
  // gpu: number
}
