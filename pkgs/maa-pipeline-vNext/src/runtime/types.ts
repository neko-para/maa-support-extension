/**
 * Runtime 模块类型定义。
 *
 * Config 类型——用户/UI 配置（独立于 maa.* 全局变量）。
 * Runtime 类型——构建后传给 MaaFramework 的运行时参数。
 */

// ═══ User-facing config types ═══

export type AdbConfig = {
  adb_path: string
  address: string
  screencap: string | number
  input: string | number
  config: unknown
}

export type Win32Config = {
  hwnd?: string | number | null
}

export type PlayCoverConfig = {
  address: string
}

export type GamepadConfig = {
  hwnd?: string | number | null
}

export type VscFixedConfig = {
  image?: string
}

export type SelectConfig = string
export type CheckboxConfig = string[]
export type InputConfig = Record<string, string>

export type OptionsConfig = Record<string, SelectConfig | CheckboxConfig | InputConfig>

export type TaskConfig = {
  name: string
  option?: OptionsConfig
}

export type InterfaceConfig = {
  controller?: string
  adb?: AdbConfig
  win32?: Win32Config
  playcover?: PlayCoverConfig
  gamepad?: GamepadConfig
  vscFixed?: VscFixedConfig
  resource?: string
  task?: TaskConfig[]
}

// ═══ Runtime output types ═══

export type ControllerRuntimeBase = {
  name: string
  display_short_side?: number
  display_long_side?: number
  display_raw?: boolean
  permission_required?: boolean
  attach_resource_path?: string[]
  option?: string[]
}

export type ControllerRuntimeVariant =
  | { type: 'adb'; args: [string, string, string | number, string | number, string] }
  | { type: 'win32'; args: [string | number, string | number, string | number, string | number] }
  | { type: 'playcover'; args: [string, string] }
  | { type: 'gamepad'; args: [string | number, string | number, string | number] }
  | { type: 'vscFixed'; args: [string] }

export type ControllerRuntime = ControllerRuntimeBase & ControllerRuntimeVariant

export type ResourceRuntime = {
  name: string
  paths: string[]
  option?: string[]
}

export type TaskRuntimeItem = {
  name: string
  entry: string
  pipeline_override: unknown[]
}

export type TaskRuntime = {
  tasks: TaskRuntimeItem[]
}

// ═══ Option resolution ═══

export type ResolvedOption = {
  name: string
  from: 'global' | 'controller' | 'resource' | 'task' | 'option' | 'preset'
  origin: string
}

// ═══ Validation errors（webview-safe，无 maa.* / i18n 依赖） ═══

export type ControllerValidationError = {
  type:
    | 'missing-controller'
    | 'missing-adb-config'
    | 'missing-win32-config'
    | 'missing-hwnd'
    | 'missing-playcover-config'
    | 'missing-playcover-address'
    | 'missing-gamepad-config'
    | 'missing-vsc-fixed-image'
    | 'unknown-controller-type'
  controller: string
}

// ═══ MAA enums（由 extension 注入，buildControllerRuntime 使用） ═══

export interface MaaEnvs {
  Win32ScreencapMethod: Record<string, string>
  Win32InputMethod: Record<string, string>
  GamepadType: Record<string, string>
}
