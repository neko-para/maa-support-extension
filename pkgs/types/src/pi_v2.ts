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
    screencap?: maa.ScreencapOrInputMethods | number
    input?: maa.ScreencapOrInputMethods | number
    config?: unknown
  }
  win32?: never
}

export type Win32Controller = ControllerBase & {
  type: 'Win32'
  adb?: never
  win32?: {
    class_regex?: string
    window_regex?: string
    screencap?: maa.ScreencapOrInputMethods | number
    mouse?: maa.ScreencapOrInputMethods | number
    keyboard?: maa.ScreencapOrInputMethods | number
  }
}

export type VscFixedController = ControllerBase & {
  type: 'VscFixed'
  adb?: never
  win32?: never
}

export type Controller = AdbController | Win32Controller | VscFixedController

export type Resource = EntryBase & {
  name: string
  path: string | string[]
  controller?: string[]
}

export type Task = EntryBase & {
  name: string
  default_check?: boolean
  resource?: string[]
  entry: string
  pipeline_override?: unknown
  option?: string[]
}

export type SelectCase = EntryBase & {
  name: string
  options?: string[]
  pipeline_override?: unknown
}

export type SelectOption = EntryBase & {
  type?: 'select'
  cases?: SelectCase[]
  default_case?: string
}

export type InputItemType = 'string' | 'int'

export type InputItem = EntryBase & {
  name: string

  default?: string
  pipeline_type?: InputItemType
  verify?: string
}

export type InputOption = EntryBase & {
  type: 'input'
  input?: InputItem[]
  pipeline_override?: unknown
}

export type SwitchCase = EntryBase & {
  name: string
  options?: string[]
  pipeline_override?: unknown
}

export type SwitchOption = EntryBase & {
  type: 'switch'
  cases?: SwitchCase[]
  default_case?: string
}

export type Option = SelectOption | InputOption | SwitchOption

export type InterfaceV2 = EntryBase & {
  interface_version: 2
  languages?: Record<string, string>
  name?: string
  mirrorchyan_rid?: string
  mirrorchyan_multiplatform?: boolean
  auto_update_ui?: boolean
  auto_update_maafw?: boolean
  github?: string
  version?: string
  contact?: string
  license?: string
  welcome?: string

  agent?: {
    child_exec?: string
    child_args?: string[]
    identifier?: string
  }

  controller?: Controller[]
  resource?: Resource[]
  task?: Task[]
  option?: Record<string, Option>
}
