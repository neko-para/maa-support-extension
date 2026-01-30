import * as rpc from 'vscode-jsonrpc/node'

import {
  type HostToSubApis,
  type MarkApis,
  type SubToHostApis,
  hostToSubReq,
  subToHostReq
} from '@mse/maa-server-proto'

export let ipc: MarkApis<HostToSubApis, SubToHostApis>

export function setupIpc(conn: rpc.MessageConnection) {
  conn.onRequest(hostToSubReq, (method, args) => {
    console.log('<--', method)
    return (ipc as any).$[method](...args)
  })

  const handlers: Record<string, Function> = {}

  ipc = new Proxy(
    {},
    {
      get(_, key: string) {
        if (key === 'then') {
          return undefined
        } else if (key === '$') {
          return handlers
        } else {
          return (...args: unknown[]) => {
            console.log('-->', key)
            return conn.sendRequest(subToHostReq, key, args)
          }
        }
      },
      set(_, key: string, val) {
        handlers[key] = val
        return true
      }
    }
  ) as MarkApis<HostToSubApis, SubToHostApis>
}
