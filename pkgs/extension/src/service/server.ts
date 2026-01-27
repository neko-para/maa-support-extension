import { ChildProcessByStdio, spawn } from 'node:child_process'
import * as net from 'node:net'
import Stream from 'node:stream'
import { v4 } from 'uuid'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti, logNoti, updateCtrlReq } from '@mse/maa-server-proto'
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
  tcpServer?: net.Server
  server?: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>
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
    if (this.server) {
      return true
    }

    if (!this.tcpServer) {
      return false
    }

    const instanceId = v4()

    this.server = spawn(
      process.argv[0],
      [context.asAbsolutePath('server/index.js'), `${this.tcpPort}`, instanceId],
      {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          MSE_MAA_LOCATION: nativeService.activeModulePath
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    this.server.stdout.on('data', data => {
      logger.info(`stdout ${data}`)
    })
    this.server.stderr.on('data', data => {
      logger.info(`stderr ${data}`)
    })
    this.server.on('close', () => {
      this.server = undefined
    })

    const [stage1, resolveStage1] = makePromise<boolean>()

    this.server!.once('spawn', () => {
      resolveStage1(true)
    })
    this.server!.once('error', () => {
      resolveStage1(false)
    })

    const [stage2, resolveStage2] = makePromise<boolean>()

    this.tcpServer.on('connection', socket => {
      this.conn = rpc.createMessageConnection(socket, socket)

      this.conn.onNotification(initNoti, clientId => {
        if (clientId === instanceId) {
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
    })

    return (await stage1) && (await stage2)
  }

  async updateCtrl(rt: InterfaceRuntime['controller_param']) {
    if (!(await this.ensureServer()) || !this.conn) {
      return false
    }

    return await this.conn.sendRequest(updateCtrlReq, rt)
  }
}
