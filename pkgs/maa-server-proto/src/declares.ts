import * as rpc from 'vscode-jsonrpc/node'

// init
export const initNoti = new rpc.NotificationType<string>('init')
export const logNoti = new rpc.NotificationType2<'info' | 'warn' | 'error', string>('log')

export const shutdownNoti = new rpc.NotificationType0('shutdown')

// universal
export const hostToSubReq = new rpc.RequestType2<string, unknown[], unknown, undefined>(
  'hostToSubReq'
)
export const subToHostReq = new rpc.RequestType2<string, unknown[], unknown, undefined>(
  'subToHostReq'
)
