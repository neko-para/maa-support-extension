export type IpcRest = {
  __builtin?: false
  cmd: string
}

export type IpcFromHostBuiltin<HostContext, WebvContext> =
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: HostContext
    }
  | {
      __builtin: true
      cmd: 'initContext'
      ctx: WebvContext
    }

export type IpcToHostBuiltin<WebvContext> =
  | {
      __builtin: true
      cmd: 'requestInit'
    }
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: WebvContext
    }

export type IpcFromHost<HostContext, WebvContext, Rest extends IpcRest> =
  | IpcFromHostBuiltin<HostContext, WebvContext>
  | Rest

export type IpcToHost<WebvContext, Rest extends IpcRest> = IpcToHostBuiltin<WebvContext> | Rest

export type ControlPanelHostContext = {
  interfaces?: {
    path: string
    content: unknown
  }[]
  refreshingInterface?: boolean
}

export type ControlPanelWebvContext = {
  selectedInterface?: string
}

export type ControlPanelToHost = {
  cmd: 'refreshInterface'
}

export type ControlPanelFromHost = never