import * as vscode from 'vscode'

import {
  HostToSubApis,
  MarkApis,
  SubToHostApis,
  hostToSubReq,
  logNoti,
  subToHostReq
} from '@mse/maa-server-proto'
import { logger } from '@mse/utils'

import { agentService, nativeService, serverService, stateService, statusBarService } from '.'
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

    this.rpc = new RpcManager(
      context.asAbsolutePath('server/index.js'),
      stateService.state.admin ?? false
    )
    this.ipc = null

    this.instMap = {}

    this.rpc.on('connectionLost', () => {
      statusBarService.showServerStatus('close')
    })
  }

  async init() {
    console.log('init ServerService')
  }

  switchAdmin(admin?: boolean) {
    if (admin === undefined) {
      admin = !this.rpc.admin
    }
    if (process.platform !== 'win32') {
      return
    }
    if (admin !== this.rpc.admin) {
      for (const panel of Object.values(this.instMap)) {
        panel.dispose()
      }
      this.instMap = {}
      agentService.stopAll()
      this.rpc.kill()
      this.rpc.admin = admin

      stateService.reduce({
        admin
      })
      statusBarService.showServerStatus('close')
    }
  }

  async setupServer() {
    statusBarService.showServerStatus('loading~spin')
    if (
      (await this.rpc.ensureConnection({
        module: nativeService.activeModulePath,
        maaLog: (context.storageUri ?? context.globalStorageUri).fsPath
      })) &&
      this.rpc.conn
    ) {
      this.rpc.conn.onNotification(logNoti, (cate, msg) => {
        logger[cate](msg)
      })

      const conn = this.rpc.conn

      conn.onRequest(subToHostReq, (method, args) => {
        logger.info('<-- ' + method)
        try {
          return (this.ipc as any).$[method](...args)
        } catch (err) {
          logger.error(`handle ${method} failed: ${err}`)
          return null
        }
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
      this.ipc.startTask = async (exec, args, cwd, env) => {
        return await agentService.startTask(exec, args, cwd, env)
      }
      this.ipc.startDebugSession = async (name, identifier) => {
        return await agentService.startDebugSession(name, identifier)
      }
      this.ipc.stopAgent = async id => {
        return await agentService.stopAgent(id)
      }
      this.ipc.quickPick = async items => {
        return (await vscode.window.showQuickPick(items)) ?? null
      }

      statusBarService.showServerStatus('check')
      return true
    } else {
      statusBarService.showServerStatus('close')
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
