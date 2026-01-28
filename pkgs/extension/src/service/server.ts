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

type IpcType = MarkApis<SubToHostApis, HostToSubApis>

export class ServerService extends BaseService {
  rpc: RpcManager
  ipc: IpcType | null

  constructor() {
    super()
    console.log('construct ServerService')

    this.rpc = new RpcManager(context.asAbsolutePath('server/index.js'), true)
    this.ipc = null
  }

  async init() {
    console.log('init ServerService')

    this.setupServer()
  }

  async setupServer() {
    if (
      (await this.rpc.ensureConnection({
        module: nativeService.activeModulePath
      })) &&
      this.rpc.conn
    ) {
      this.rpc.conn.onNotification(logNoti, msg => {
        logger.info(msg)
      })

      const conn = this.rpc.conn

      conn.onRequest(subToHostReq, (method, args) => {
        return (this.ipc as any).$[method](...args)
      })

      const handlers: Record<string, Function> = {}

      this.ipc = new Proxy(
        {},
        {
          get(_, key) {
            if (key === 'then') {
              return undefined
            } else if (key === '$') {
              return handlers
            } else {
              return (...args: unknown[]) => {
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

  async updateCtrl(rt: InterfaceRuntime['controller_param']) {
    const conn = await this.ensureServer()
    if (!conn) {
      return false
    }

    return await conn.updateController(rt)
  }

  async setupInst(rt: InterfaceRuntime) {
    const conn = await this.ensureServer()
    if (!conn) {
      return { error: 'server start failed' }
    }

    return await conn.setupInstance(rt)
  }

  async getScreencap() {
    const conn = await this.ensureServer()
    if (!conn) {
      return null
    }

    return await conn.getScreencap()
  }

  async refreshAdb() {
    const conn = await this.ensureServer()
    if (!conn) {
      return []
    }

    return await conn.refreshAdb()
  }
}
