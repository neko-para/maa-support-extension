export type IpcRest = {
  __builtin?: false
  cmd: string
}

export type IpcFromHostBuiltin<Context> = {
  __builtin: true
  cmd: 'initContext'
  ctx: Context
}

export type IpcToHostBuiltin<Context> =
  | {
      __builtin: true
      cmd: 'requestInit'
    }
  | {
      __builtin: true
      cmd: 'updateContext'
      ctx: Context
    }

export type IpcFromHost<Context, Rest extends IpcRest> = IpcFromHostBuiltin<Context> | Rest

export type IpcToHost<Context, Rest extends IpcRest> = IpcToHostBuiltin<Context> | Rest
