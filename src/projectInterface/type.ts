import type * as maa from '@nekosu/maa-node'

export type Interface = {
  controller: {
    name: string
    type: 'Adb' | 'Win32'
    adb?: {
      touch?: number
      key?: number
      screencap?: number
      config?: unknown
    }
    win32?: {
      method: 'Find' | 'Search' | 'Cursor' | 'Desktop' | 'Foreground'
      class_name?: string
      window_name?: string
      touch?: number
      key?: number
      screencap?: number
    }
  }[]
  resource: {
    name: string
    path: string[]
  }[]
  task: {
    name: string
    entry: string
    param?: unknown
    option?: string[]
  }[]
  option?: Record<
    string,
    {
      cases: {
        name: string
        param?: unknown
      }[]
      default_case?: string
    }
  >
  recognizer?: Record<
    string,
    {
      exec_path: string
      exec_param?: string[]
    }
  >
  action?: Record<
    string,
    {
      exec_path: string
      exec_param?: string[]
    }
  >
  version?: string
  message?: string
}

export type InterfaceConfig = {
  controller: {
    name: string
    type: 'Adb' | 'Win32'
  }
  adb?: {
    adb_path: string
    address: string
    config: unknown
  }
  win32?: {
    hwnd?: maa.Win32Hwnd
  }
  resource: string
  task: {
    name: string
    option?: {
      name: string
      value: string
    }[]
  }[]
}

export type InterfaceRuntime = {
  controller_param:
    | ({ ctype: 'adb' } & maa.AdbInfo)
    | {
        ctype: 'win32'
        hwnd: maa.Win32Hwnd
        controller_type: number
      }
  resource_path: string[]
  task: {
    name: string
    entry: string
    param: unknown
  }[]
  recognizer: Record<
    string,
    {
      exec_path: string
      exec_param?: string[]
    }
  >
  action: Record<
    string,
    {
      exec_path: string
      exec_param?: string[]
    }
  >
}
