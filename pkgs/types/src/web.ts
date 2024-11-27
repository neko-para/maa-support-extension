export type IpcRest = {
  __builtin?: false
  cmd: string
}

export type IpcFromHostBuiltin<HostContext> =
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: HostContext
    }
  | {
      __builtin: true
      cmd: 'inited'
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

export type IpcFromHost<HostContext, Rest extends IpcRest> = IpcFromHostBuiltin<HostContext> | Rest

export type IpcToHost<WebvContext, Rest extends IpcRest> = IpcToHostBuiltin<WebvContext> | Rest

export type ControlPanelHostContext = {
  interfaces?: string[]
}

export type ControlPanelWebvContext = {
  selectedInterface?: string
}

export type ControlPanelToHost = {
  cmd: 'refreshInterface'
}

export type ControlPanelFromHost = never
