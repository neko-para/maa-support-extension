export type AdbConfig = {
  adb_path: string
  address: string
  screencap: maa.ScreencapOrInputMethods
  input: maa.ScreencapOrInputMethods
  config: unknown
}

export type Win32Config = {
  hwnd?: maa.DesktopHandle | null
}

export type PlayCoverConfig = {
  address: string
}

export type GamepadConfig = {
  hwnd?: maa.DesktopHandle | null
}

export type WlRootsConfig = {
  socket_path?: string
}

export type VscFixedConfig = {
  image?: string
}

export type SelectConfig = string
export type CheckboxConfig = string[]
export type InputConfig = Record<string, string>

export type OptionsConfig = {
  [option in string]?: SelectConfig | CheckboxConfig | InputConfig
}

export type TaskConfig = {
  name: string
  option?: OptionsConfig

  __key?: string
}

export type InterfaceConfig = {
  controller?: string
  adb?: AdbConfig
  win32?: Win32Config
  playcover?: PlayCoverConfig
  gamepad?: GamepadConfig
  wlroots?: WlRootsConfig
  vscFixed?: VscFixedConfig

  resource?: string
  task?: TaskConfig[]

  __locale?: string
}
