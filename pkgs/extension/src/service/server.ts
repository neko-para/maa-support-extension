import { ChildProcessByStdio, spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as net from 'node:net'
import Stream from 'node:stream'
import { v4 } from 'uuid'
import * as rpc from 'vscode-jsonrpc/node'

import {
  getScreencapReq,
  initNoti,
  logNoti,
  setupInstReq,
  updateCtrlReq
} from '@mse/maa-server-proto'
import { InterfaceRuntime } from '@mse/types'
import { logger } from '@mse/utils'

import { nativeService } from '.'
import { BaseService, context } from './context'

function makePromise<T>() {
  let res: (value: T) => void = () => {}
  const pro = new Promise<T>(resolve => {
    res = resolve
  })
  return [pro, res] as [Promise<T>, (value: T) => void]
}

export class ServerService extends BaseService {
  detached = false
  tcpServer?: net.Server
  serverProc?: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>
  instanceId?: string
  conn?: rpc.MessageConnection

  constructor() {
    super()
    console.log('construct ServerService')
  }

  async init() {
    console.log('init ServerService')
  }

  async ensureServer() {
    return (await this.setupTcpServer()) && (await this.setupServer())
  }

  get tcpPort() {
    const addr = (this.tcpServer?.address() ?? null) as net.AddressInfo | null
    return addr?.port ?? 0
  }

  async setupTcpServer() {
    if (this.tcpServer) {
      return true
    }

    this.tcpServer = net.createServer()

    const [promise, resolve] = makePromise<boolean>()

    this.tcpServer.listen(0, '127.0.0.1', async () => {
      resolve(true)
    })
    this.tcpServer.on('error', () => {
      this.tcpServer = undefined
      resolve(false)
    })

    return promise
  }

  async setupServer() {
    if (!this.tcpServer) {
      return false
    }

    if (this.serverProc || this.detached) {
      return true
    }

    this.instanceId = v4()

    let useAdmin = true

    const [stage1, resolveStage1] = makePromise<boolean>()

    if (useAdmin && process.platform === 'win32') {
      this.detached = true

      const ps1File = context.asAbsolutePath('uac.ps1')
      const jsFile = context.asAbsolutePath('server/index.js')
      await fs.writeFile(
        ps1File,
        `Start-Process -FilePath cmd -ArgumentList "/C","set ELECTRON_RUN_AS_NODE=\`"1\`" & \`"${process.argv[0]}\`" \`"${jsFile}\`" \`"${nativeService.activeModulePath}\`" \`"${this.tcpPort}\`" \`"${this.instanceId}\`"" -Wait -Verb RunAs`
      )
      const cp = spawn('powershell.exe', [ps1File])
      cp.on('close', code => {
        resolveStage1(code === 0)
      })
    } else {
      this.detached = false

      this.serverProc = spawn(
        process.argv[0],
        [
          context.asAbsolutePath('server/index.js'),
          nativeService.activeModulePath,
          `${this.tcpPort}`,
          this.instanceId
        ],
        {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1'
          },
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )
      this.serverProc.stdout.on('data', data => {
        logger.info(`stdout ${data}`)
      })
      this.serverProc.stderr.on('data', data => {
        logger.info(`stderr ${data}`)
      })
      this.serverProc.on('close', () => {
        this.serverProc = undefined
      })

      this.serverProc.once('spawn', () => {
        resolveStage1(true)
      })
      this.serverProc.once('error', () => {
        resolveStage1(false)
      })
    }

    const [stage2, resolveStage2] = makePromise<boolean>()

    this.tcpServer.on('connection', socket => {
      this.conn = rpc.createMessageConnection(socket, socket)

      this.conn.onNotification(initNoti, clientId => {
        if (clientId === this.instanceId) {
          resolveStage2(true)
        } else {
          socket.destroySoon()
          resolveStage2(false)
        }
      })

      this.conn.onNotification(logNoti, msg => {
        logger.info(msg)
      })

      this.conn.listen()

      socket.on('close', () => {
        this.serverProc?.kill()
        this.serverProc = undefined
        this.detached = false
      })
    })

    return (await stage1) && (await stage2)
  }

  async updateCtrl(rt: InterfaceRuntime['controller_param']) {
    if (!(await this.ensureServer()) || !this.conn) {
      return false
    }

    return await this.conn.sendRequest(updateCtrlReq, rt)
  }

  async setupInst(rt: InterfaceRuntime) {
    if (!(await this.ensureServer()) || !this.conn) {
      return { error: 'server start failed' }
    }

    return await this.conn.sendRequest(setupInstReq, rt)
  }

  async getScreencap() {
    if (!(await this.ensureServer()) || !this.conn) {
      return null
    }

    return await this.conn.sendRequest(getScreencapReq, null)
  }
}
