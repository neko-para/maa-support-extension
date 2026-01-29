import {
  HostToSubApis,
  MarkApis,
  SubToHostApis,
  hostToSubReq,
  logNoti,
  subToHostReq
} from '@mse/maa-server-proto'
import { InterfaceRuntime } from '@mse/types'
import { logger } from '@mse/utils'

import { nativeService } from '.'
import { BaseService, context } from './context'
import { RpcManager } from './utils/rpc'
import { WebviewLaunchPanel } from './webview/launch'

export type IpcType = MarkApis<SubToHostApis, HostToSubApis>

export class ServerService extends BaseService {
  rpc: RpcManager
  ipc: IpcType | null

  instMap: Record<string, WebviewLaunchPanel>

  constructor() {
    super()
    console.log('construct ServerService')

    this.rpc = new RpcManager(context.asAbsolutePath('server/index.js'), true)
    this.ipc = null

    this.instMap = {}
  }

  async init() {
    console.log('init ServerService')

    this.setupServer()
  }

  async setupServer() {
    if (
      (await this.rpc.ensureConnection({
        module: nativeService.activeModulePath,
        maaLog: (context.storageUri ?? context.globalStorageUri).fsPath
      })) &&
      this.rpc.conn
    ) {
      this.rpc.conn.onNotification(logNoti, msg => {
        logger.info(msg)
      })

      const conn = this.rpc.conn

      conn.onRequest(subToHostReq, (method, args) => {
        logger.info('<-- ' + method)
        return (this.ipc as any).$[method](...args)
      })

      const handlers: Record<string, Function> = {}

      this.ipc = new Proxy(
        {},
        {
          get(_, key: string) {
            if (key === 'then') {
              return undefined
            } else if (key === '$') {
              return handlers
            } else {
              return (...args: unknown[]) => {
                logger.info('--> ' + key)
                return conn.sendRequest(hostToSubReq, key, args)
              }
            }
          },
          set(_, key: string, val) {
            handlers[key] = val
            return true
          }
        }
      ) as IpcType

      this.ipc.pushNotify = async (inst, msg) => {
        await this.instMap[inst]?.pushNotify(msg as any)
      }

      return true
    } else {
      return false
    }
  }

  async ensureServer() {
    if (!this.rpc.conn) {
      if (!(await this.setupServer())) {
        return null
      }
    }

    return this.ipc ?? null
  }
}
