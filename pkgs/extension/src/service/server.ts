import { getScreencapReq, logNoti, setupInstReq, updateCtrlReq } from '@mse/maa-server-proto'
import { InterfaceRuntime } from '@mse/types'
import { logger } from '@mse/utils'

import { nativeService } from '.'
import { BaseService, context } from './context'
import { RpcManager } from './utils/rpc'

export class ServerService extends BaseService {
  rpc: RpcManager

  constructor() {
    super()
    console.log('construct ServerService')

    this.rpc = new RpcManager(context.asAbsolutePath('server/index.js'), true)
  }

  async init() {
    console.log('init ServerService')

    this.rpc.ensureConnection({
      module: nativeService.activeModulePath
    })
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
    return this.rpc.conn ?? null
  }

  async updateCtrl(rt: InterfaceRuntime['controller_param']) {
    const conn = await this.ensureServer()
    if (!conn) {
      return false
    }

    return await conn.sendRequest(updateCtrlReq, rt)
  }

  async setupInst(rt: InterfaceRuntime) {
    const conn = await this.ensureServer()
    if (!conn) {
      return { error: 'server start failed' }
    }

    return await conn.sendRequest(setupInstReq, rt)
  }

  async getScreencap() {
    const conn = await this.ensureServer()
    if (!conn) {
      return null
    }

    return await conn.sendRequest(getScreencapReq, null)
  }
}
