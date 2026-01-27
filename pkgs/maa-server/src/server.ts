import * as net from 'node:net'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti, logNoti, setupInstReq, updateCtrlReq } from '@mse/maa-server-proto'

import { setupInst, updateCtrl } from './maa'

function makePromise<T>() {
  let res: (value: T) => void = () => {}
  const pro = new Promise<T>(resolve => {
    res = resolve
  })
  return [pro, res] as [Promise<T>, (value: T) => void]
}

let conn: rpc.MessageConnection | undefined

export async function initServer() {
  const [promise, resolve] = makePromise<boolean>()

  console.log('port', process.argv[2])
  console.log('id', process.argv[3])

  const socket = new net.Socket()
  socket.connect(
    {
      host: '127.0.0.1',
      port: parseInt(process.argv[2])
    },
    () => {
      conn = rpc.createMessageConnection(socket, socket)

      conn.listen()

      conn.sendNotification(initNoti, process.argv[3])

      conn.onRequest(updateCtrlReq, rt => {
        return updateCtrl(rt)
      })

      conn.onRequest(setupInstReq, rt => {
        return setupInst(rt)
      })
    }
  )
  socket.on('error', () => {
    resolve(false)
  })

  return promise
}

export function sendLog(msg: string) {
  conn?.sendNotification(logNoti, msg)
}
