import * as net from 'node:net'
import * as rpc from 'vscode-jsonrpc/node'

import {
  getScreencapReq,
  initNoti,
  logNoti,
  setupInstReq,
  updateCtrlReq
} from '@mse/maa-server-proto'

import { getScreencap, setupInst, updateCtrl } from './maa'
import { option } from './options'

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

  const socket = new net.Socket()
  socket.connect(
    {
      host: '127.0.0.1',
      port: option.port
    },
    () => {
      socket.on('data', data => {
        console.log(data.toString())
      })

      conn = rpc.createMessageConnection(socket, socket)

      conn.listen()

      conn.sendNotification(initNoti, option.id)

      conn.onRequest(updateCtrlReq, rt => {
        return updateCtrl(rt)
      })

      conn.onRequest(setupInstReq, rt => {
        return setupInst(rt)
      })

      conn.onRequest(getScreencapReq, () => {
        return getScreencap()
      })

      resolve(true)
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
