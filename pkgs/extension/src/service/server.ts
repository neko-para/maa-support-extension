import * as vscode from 'vscode'

import {
  type HostToSubApis,
  type MarkApis,
  type SubToHostApis,
  hostToSubReq,
  logNoti,
  subToHostReq
} from '@nekosu/maa-server-proto'

import { agentService, nativeService, rootService, stateService, statusBarService } from '.'
import { logger } from '../utils/logger'
import { BaseService, context } from './context'
import { RpcManager } from './utils/rpc'
import { WebviewLaunchPanel } from './webview/launch'

export type IpcType = MarkApis<SubToHostApis, HostToSubApis>

// 简单糊一下, 在这个文件里面把类型抹掉
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace globalThis {
  let maa: unknown | undefined
}

export class ServerService extends BaseService {
  rpc: RpcManager
  ipc: IpcType | null
  status: boolean
  debugMode: boolean
  saveDraw: boolean
  maaLogDir: string | null

  instMap: Record<string, WebviewLaunchPanel>

  statusChanged = new vscode.EventEmitter<boolean>()
  get onStatusChanged() {
    return this.statusChanged.event
  }

  constructor() {
    super()
    console.log('construct ServerService')
    this.rpc = new RpcManager(
      context.asAbsolutePath('server/index.mjs'),
      stateService.state.admin ?? false
    )
    this.ipc = null
    this.status = false
    this.debugMode = stateService.state.debugMode ?? true
    this.saveDraw = stateService.state.saveDraw ?? false
    this.maaLogDir = null

    this.instMap = {}

    this.rpc.on('connectionLost', () => {
      this.maaLogDir = null
      this.pushStatus(false)
      statusBarService.showServerStatus('close')
    })

    this.defer = this.statusChanged
  }

  async init() {
    console.log('init ServerService')

    this.defer = rootService.onActiveResourceChanged(() => {
      void this.handleMaaLogContextChanged()
    })
    this.defer = rootService.onConfigChanged(() => {
      void this.handleMaaLogContextChanged()
    })
  }

  private async handleMaaLogContextChanged() {
    if (!this.maaLogDir) {
      return
    }

    try {
      const nextMaaLogDir = await rootService.resolveMaaLogDir()
      if (nextMaaLogDir.fsPath === this.maaLogDir) {
        return
      }
    } catch (err) {
      logger.error(`Failed to resolve changed MAA log directory: ${err}`)
    }

    this.kill()
    this.pushStatus(false)
    statusBarService.showServerStatus('close')
  }

  kill() {
    for (const panel of Object.values(this.instMap)) {
      panel.dispose()
    }
    this.instMap = {}
    agentService.stopAll()
    this.rpc.kill()
    this.maaLogDir = null
    globalThis.maa = undefined
  }

  switchAdmin(admin?: boolean) {
    if (admin === undefined) {
      admin = !this.rpc.admin
    }
    if (process.platform !== 'win32') {
      return
    }
    if (admin !== this.rpc.admin) {
      this.kill()
      this.rpc.admin = admin

      stateService.reduce({
        admin
      })
      this.pushStatus(false)
      statusBarService.showServerStatus('close')
    }
  }

  switchDebugMode(debugMode?: boolean) {
    if (debugMode === undefined) {
      debugMode = !this.debugMode
    }
    if (debugMode !== this.debugMode) {
      this.kill()
      this.debugMode = debugMode

      stateService.reduce({
        debugMode
      })
      this.pushStatus(false)
      statusBarService.showServerStatus('close')
    }
  }

  switchSaveDraw(saveDraw?: boolean) {
    if (saveDraw === undefined) {
      saveDraw = !this.saveDraw
    }
    if (saveDraw !== this.saveDraw) {
      this.kill()
      this.saveDraw = saveDraw

      stateService.reduce({
        saveDraw
      })
      this.pushStatus(false)
      statusBarService.showServerStatus('close')
    }
  }

  async setupServer() {
    statusBarService.showServerStatus('loading~spin')
    const maaLogDir = await rootService.resolveMaaLogDir()
    if (
      (await nativeService.load()) &&
      (await this.rpc.ensureConnection({
        module: nativeService.activeModulePath,
        maaLog: maaLogDir.fsPath,
        debugMode: this.debugMode,
        saveDraw: this.saveDraw
      })) &&
      this.rpc.conn
    ) {
      this.rpc.conn.onNotification(logNoti, (cate, msg) => {
        logger[cate](msg)
      })

      const conn = this.rpc.conn

      conn.onRequest(subToHostReq, (method, args) => {
        if (method !== 'pushNotify') {
          logger.info('<-- ' + method)
        }
        try {
          return this.ipc?.$[method](...args)
        } catch (err) {
          logger.error(`handle ${method} failed: ${err}`)
          return null
        }
      })

      const handlers: Record<string, unknown> = {}

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
                if (key !== 'pushNotify') {
                  logger.info('--> ' + key)
                }
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
        await this.instMap[inst]?.pushNotify(msg as maa.TaskerNotify | maa.TaskerContextNotify)
      }
      this.ipc.startTask = async (exec, args, cwd, env) => {
        return await agentService.startTask(exec, args, cwd, env)
      }
      this.ipc.startDebugSession = async (name, identifier, env) => {
        return await agentService.startDebugSession(name, identifier, env)
      }
      this.ipc.stopAgent = async id => {
        return await agentService.stopAgent(id)
      }
      this.ipc.quickPick = async items => {
        return (await vscode.window.showQuickPick(items)) ?? null
      }

      this.pushStatus(true)
      this.maaLogDir = maaLogDir.fsPath
      statusBarService.showServerStatus('check')
      return true
    } else {
      this.pushStatus(false)
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

  async fetchConstants() {
    if (globalThis.maa) {
      return true
    }

    const ipc = await this.ensureServer()
    if (ipc) {
      globalThis.maa = await ipc.fetchConstants()
      nativeService.versionChanged.fire()
      return true
    } else {
      return false
    }
  }

  pushStatus(value: boolean) {
    this.status = value
    this.statusChanged.fire(this.status)
  }
}
