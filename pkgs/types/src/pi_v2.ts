import type * as maa from '@maaxyz/maa-node'

export type LocalizedString =
  | string
  | {
      [locale: string]: string
    }

export type EntryBase = {
  label?: LocalizedString
  description?: LocalizedString
  icon?: string
}

export type ControllerBase = EntryBase & {
  name: string
  // 三选一, 从上到下优先
  resolution?: {
    short?: number
    long?: number
    raw?: true
  }
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
  // 这个我改了个名字
  enable?: string[]
  pipeline_override?: unknown
}

export type SelectOption = EntryBase & {
  type?: 'Select'
  cases: SelectCase[]
  default_case?: string
}

export type InputItem = EntryBase & {
  name: string
} & (
    | {
        type: 'number'
        default?: number
      }
    | {
        type: 'string'
        default?: string
        verify?: string
      }
  )

export type InputOption = EntryBase & {
  type: 'Input'
  // 要支持吗?
  // enable?: string[]
  input: InputItem[]
  pipeline_override?: unknown
}

export type Option = SelectOption | InputOption

export type InterfaceV2 = {
  interface_version: 2
  languages?: string[]
  name?: LocalizedString // 这里是不是和别的地方统一, 改成label
  title?: LocalizedString
  icon?: string
  mirrorchyan_rid?: string
  mirrorchyan_multiplatform?: boolean
  auto_update_ui?: boolean
  auto_update_maafw?: boolean
  github?: string
  version?: string
  contact?: LocalizedString
  license?: string
  welcome?: LocalizedString
  description?: LocalizedString

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
