import type * as maa from '@maaxyz/maa-node'

export type EntryBase = {
  label?: string
  description?: string
  icon?: string
}

export type ControllerBase = EntryBase & {
  name: string
  // 三选一, 从上到下优先
  display_short_side?: number
  display_long_side?: number
  display_raw?: boolean
}

export type AdbController = ControllerBase & {
  type: 'Adb'
  adb?: {
    screencap?: maa.api.ScreencapOrInputMethods
    input?: maa.api.ScreencapOrInputMethods
    config?: unknown
  }
}

export type Win32Controller = ControllerBase & {
  type: 'Win32'
  win32?: {
    class_regex?: string
    window_regex?: string
    screencap?: maa.api.ScreencapOrInputMethods
    input?: maa.api.ScreencapOrInputMethods
  }
}

export type Controller = AdbController | Win32Controller

export type Resource = EntryBase & {
  name: string
  path: string | string[]
}

export type Task = EntryBase & {
  name: string
  // 我觉得这两个不太对劲
  // force_check?: boolean
  // default_check?: boolean
  entry: string
  pipeline_override?: unknown
  option?: string[]
}

export type SelectCase = EntryBase & {
  name: string
  option?: string[]
  pipeline_override?: unknown
}

export type SelectOption = EntryBase & {
  type?: 'Select'
  cases: SelectCase[]
  default_case?: string
}

export type InputItem = EntryBase & {
  name: string

  default?: string
  pipeline_type?: 'number' | 'string'
  verify?: string
}

export type InputOption = EntryBase & {
  type: 'Input'
  input: InputItem[]
  pipeline_override?: unknown
}

export type Option = SelectOption | InputOption

export type InterfaceV2 = {
  interface_version: 2
  languages?: Record<string, string>
  name?: string // 这里是不是和别的地方统一, 改成label
  title?: string
  icon?: string
  mirrorchyan_rid?: string
  mirrorchyan_multiplatform?: boolean
  auto_update_ui?: boolean
  auto_update_maafw?: boolean
  github?: string
  version?: string
  contact?: string
  license?: string
  welcome?: string
  description?: string

  // 是不是考虑支持区分平台? 不然只能在action里面改
  agent?: {
    child_exec?: string
    child_args?: string[]
    identifier?: string
  }

  controller: Controller[]
  resource: Resource[]
  task: Task[]
  option?: Record<string, Option>
}
