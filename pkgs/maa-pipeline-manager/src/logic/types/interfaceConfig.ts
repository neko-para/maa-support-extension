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

export type LinuxConfig = {
  // gamescope 实例的显示编号，连接时按此匹配实例并解析 pw_node_id / eis_socket_path
  display_no?: number
  wlr_socket_path?: string
  uinput_screen_width?: number
  uinput_screen_height?: number
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
  linux?: LinuxConfig
  vscFixed?: VscFixedConfig

  resource?: string
  task?: TaskConfig[]

  __locale?: string
}
