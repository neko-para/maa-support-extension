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
  | {
      type: 'adb'
      args: [
        adb_path: string,
        address: string,
        screencap: maa.ScreencapOrInputMethods,
        input: maa.ScreencapOrInputMethods,
        config: string
      ]
    }
  | {
      type: 'win32'
      args: [
        hwnd: maa.DesktopHandle,
        screencap: maa.ScreencapOrInputMethods,
        mouse: maa.ScreencapOrInputMethods,
        keyboard: maa.ScreencapOrInputMethods
      ]
    }
  | {
      type: 'playcover'
      args: [address: string, uuid: string]
    }
  | {
      type: 'gamepad'
      args: [hwnd: maa.DesktopHandle, screencap: maa.ScreencapOrInputMethods, gamepad: maa.Uint64]
    }
  | {
      type: 'wlroots'
      args: [socket_path: string]
    }
  | {
      type: 'vscFixed'
      args: [image: string]
    }

export type ControllerRuntime = ControllerRuntimeBase & ControllerRuntimeVariant

export type ResourceRuntime = {
  name: string

  paths: string[]
  option?: string[]
}

export type TaskRuntime = {
  tasks: {
    name: string
    entry: string
    pipeline_override: unknown[]
  }[]
}

export type AgentRuntime = {
  child_exec?: string
  child_args?: string[]
  identifier?: string
  debug_session?: string
}

export type InterfaceRuntime = {
  root: string
  controller: ControllerRuntime
  resource: ResourceRuntime
  task: TaskRuntime
  agent: AgentRuntime[]
}
