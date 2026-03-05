import type { OptionsConfig } from './interfaceConfig'
import type { ControllerRuntimeBase } from './interfaceRuntime'

export type EntryBase = {
  label?: string
  description?: string
  icon?: string
}

export type ControllerBase = EntryBase & ControllerRuntimeBase

export type AdbController = ControllerBase & {
  type: 'Adb'
  adb?: never
  win32?: never
  playconver?: never
  gamepad?: never
}

export type Win32Controller = ControllerBase & {
  type: 'Win32'
  adb?: never
  win32?: {
    class_regex?: string
    window_regex?: string
    screencap?: keyof typeof maa.Win32ScreencapMethod
    mouse?: keyof typeof maa.Win32InputMethod
    keyboard?: keyof typeof maa.Win32InputMethod
  }
  playconver?: never
  gamepad?: never
}

export type PlayCoverController = ControllerBase & {
  type: 'PlayCover'
  adb?: never
  win32?: never
  playcover?: {
    uuid?: string
  }
  gamepad?: never
}

export type GamepadController = ControllerBase & {
  type: 'Gamepad'
  adb?: never
  win32?: never
  playcover?: never
  gamepad?: {
    class_regex?: string
    window_regex?: string
    screencap?: keyof typeof maa.Win32InputMethod
    gamepad_type?: keyof typeof maa.GamepadType
  }
}

export type Controller = AdbController | Win32Controller | PlayCoverController | GamepadController

export type Resource = EntryBase & {
  name: string
  path: string | string[]
  controller?: string[]
  option?: string[]
}

export type Task = EntryBase & {
  name: string
  default_check?: boolean
  resource?: string[]
  controller?: string[]
  entry: string
  pipeline_override?: unknown
  option?: string[]
}

export type OptionBase = EntryBase & {
  controller?: string[]
  resource?: string[]
}

export type SelectCase = EntryBase & {
  name: string
  option?: string[]
  pipeline_override?: unknown
}

export type SelectOption = OptionBase & {
  type?: 'select'
  cases?: SelectCase[]
  default_case?: string
}

export type CheckboxCase = EntryBase & {
  name: string
  option?: string[]
  pipeline_override?: unknown
}

export type CheckboxOption = OptionBase & {
  type: 'checkbox'
  cases?: CheckboxCase[]
  default_case?: string[]
}

export type InputItemType = 'string' | 'int' | 'bool'

export type InputItem = EntryBase & {
  name: string

  default?: string
  pipeline_type?: InputItemType
  verify?: string
  pattern_msg?: string
}

export type InputOption = OptionBase & {
  type: 'input'
  inputs?: InputItem[]
  pipeline_override?: unknown
}

export type SwitchCase = EntryBase & {
  name: string
  option?: string[]
  pipeline_override?: unknown
}

export type SwitchOption = OptionBase & {
  type: 'switch'
  cases?: SwitchCase[]
  default_case?: string
}

export type Option = SelectOption | CheckboxOption | InputOption | SwitchOption

export type AgentConfig = {
  child_exec?: string
  child_args?: string[]
  identifier?: string
}

export type PresetTask = {
  name: string
  enabled?: boolean
  option?: OptionsConfig
}

export type Preset = EntryBase & {
  name: string
  task?: PresetTask[]
}

export type Interface = EntryBase & {
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

  agent?: AgentConfig | AgentConfig[]

  controller?: Controller[]
  resource?: Resource[]
  task?: Task[]
  option?: Record<string, Option>
  global_option?: string[]
  preset?: Preset[]

  import?: string[]
}
