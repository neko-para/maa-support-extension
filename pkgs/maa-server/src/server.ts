import * as net from 'node:net'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti, logNoti, shutdownNoti } from '@nekosu/maa-server-proto'

import { ipc, setupIpc } from './apis'
import {
  agentStopped,
  destroyInstance,
  getActDetail,
  getKnownTasks,
  getNode,
  getRecoDetail,
  getScreencap,
  postStop,
  postTask,
  resize,
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

      ipc.fetchConstants = async () => {
        return {
          Status: maa.Status,
          AdbScreencapMethod: maa.AdbScreencapMethod,
          AdbInputMethod: maa.AdbInputMethod,
          Win32ScreencapMethod: maa.Win32ScreencapMethod,
          Win32InputMethod: maa.Win32InputMethod,
          GamepadType: maa.GamepadType,
          // Linux 常量仅在本地 fork 构建中存在；官方发布版缺失时回退硬编码表
          // （数值见 MaaFramework MaaDef.h，协议稳定）
          LinuxScreencapMethod: maa.LinuxScreencapMethod ?? {
            Wlr: 1,
            ExtImage: 2,
            PipeWire: 4
          },
          LinuxInputMethod: maa.LinuxInputMethod ?? {
            Wlr: 1,
            UInput: 2,
            Libei: 4
          },
          Global: {
            version_from_macro: maa.Global.version_from_macro,
            version: maa.Global.version
          }
        }
      }

      ipc.updateController = updateCtrl
      ipc.setupInstance = setupInst
      ipc.getScreencap = getScreencap
      ipc.resize = resize
      ipc.performOcr = performOcr
      ipc.performTemplateMatch = performTemplateMatch
      ipc.performReco = performReco

      ipc.refreshAdb = async () => {
        return (await maa.AdbController.find()) ?? []
      }
      ipc.refreshDesktop = async () => {
        return (await maa.Win32Controller.find()) ?? []
      }
      ipc.refreshGamescope = async () => {
        return (await maa.LinuxController.find_gamescope_instances()) ?? []
      }
      ipc.postTask = postTask
      ipc.postStop = postStop
      ipc.getKnownTasks = getKnownTasks
      ipc.destroyInstance = destroyInstance

      ipc.getRecoDetail = getRecoDetail
      ipc.getActDetail = getActDetail
      ipc.getNode = getNode

      ipc.agentStopped = agentStopped

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
    conn?.sendNotification(logNoti, 'info', msg)
  },
  warn(msg: string) {
    conn?.sendNotification(logNoti, 'warn', msg)
  },
  error(msg: string) {
    conn?.sendNotification(logNoti, 'error', msg)
  }
}
