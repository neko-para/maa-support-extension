import * as net from 'node:net'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti, logNoti, shutdownNoti } from '@mse/maa-server-proto'

import { ipc, setupIpc } from './apis'
import {
  destroyInstance,
  getActDetail,
  getKnownTasks,
  getNode,
  getRecoDetail,
  getScreencap,
  postStop,
  postTask,
  setupInst,
  updateCtrl
} from './maa'
import { option } from './options'
import { performOcr } from './tools/ocr'
import { performReco } from './tools/reco'
import { performTemplateMatch } from './tools/templateMatch'

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
      conn = rpc.createMessageConnection(socket, socket)

      conn.listen()

      conn.sendNotification(initNoti, option.id)

      conn.onNotification(shutdownNoti, () => {
        process.exit(0)
      })

      setupIpc(conn)

      ipc.updateController = updateCtrl
      ipc.setupInstance = setupInst
      ipc.getScreencap = getScreencap
      ipc.performOcr = performOcr
      ipc.performTemplateMatch = performTemplateMatch
      ipc.performReco = performReco

      ipc.refreshAdb = async () => {
        return (await maa.AdbController.find()) ?? []
      }
      ipc.refreshDesktop = async () => {
        return (await maa.Win32Controller.find()) ?? []
      }
      ipc.postTask = postTask
      ipc.postStop = postStop
      ipc.getKnownTasks = getKnownTasks
      ipc.destroyInstance = destroyInstance

      ipc.getRecoDetail = getRecoDetail
      ipc.getActDetail = getActDetail
      ipc.getNode = getNode

      resolve(true)
    }
  )
  socket.on('error', () => {
    resolve(false)
  })

  return promise
}

export const logger = {
  info(msg: string) {
    conn?.sendNotification('info', msg)
  },
  warn(msg: string) {
    conn?.sendNotification('warn', msg)
  },
  error(msg: string) {
    conn?.sendNotification('error', msg)
  }
}
