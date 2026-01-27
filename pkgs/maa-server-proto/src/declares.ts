import * as rpc from 'vscode-jsonrpc/node'

import type { InterfaceRuntime } from '@mse/types'

// sub to host
export const initNoti = new rpc.NotificationType<string>('init')
export const logNoti = new rpc.NotificationType<string>('log')

// host to sub
export const updateCtrlReq = new rpc.RequestType<
  InterfaceRuntime['controller_param'],
  boolean,
  undefined
>('updateCtrl')
export const setupInstReq = new rpc.RequestType<
  InterfaceRuntime,
  {
    handle?: string
    error?: string
  },
  undefined
>('setupInst')
export const getScreencapReq = new rpc.RequestType<null, string | null, undefined>('getScreencap')
