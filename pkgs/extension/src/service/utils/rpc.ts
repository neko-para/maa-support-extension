import * as net from 'node:net'
import { v4 } from 'uuid'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti } from '@mse/maa-server-proto'
import { logger } from '@mse/utils'

import { ProcessManager } from './process'
import { makePromise } from './promise'

function encodeParam(data: unknown) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

export class RpcManager {
  script: string
  admin: boolean
  id: string

  server?: net.Server
  proc?: ProcessManager
  conn?: rpc.MessageConnection

  get port() {
    const addr = (this.server?.address() ?? null) as net.AddressInfo | null
    return addr?.port ?? 0
  }

  constructor(script: string, admin: boolean) {
    this.script = script
    this.admin = admin
    this.id = v4()
  }

  async ensureServer() {
    if (this.server) {
      return true
    }

    const server = net.createServer()

    const [promise, resolve] = makePromise<boolean>()

    server.listen(0, '127.0.0.1', () => {
      if (!this.server) {
        this.server = server
        resolve(true)
        logger.info(`server listen at ${this.port}`)
      } else {
        server.close()
        resolve(false)
      }
    })
    server.on('error', () => {
      resolve(false)
    })
    server.on('close', () => {
      if (server === this.server) {
        this.server = undefined
      }
    })

    return promise
  }

  async ensureConnection(args: Record<string, unknown>) {
    if (!(await this.ensureServer())) {
      return false
    }

    if (!this.server) {
      return false
    }

    if (this.proc) {
      this.proc.kill()
      this.proc.clean?.()
      this.proc = undefined
    }

    const [promise, resolve] = makePromise<boolean>()

    const setupConnection = (socket: net.Socket) => {
      logger.info('connection established')
      const conn = rpc.createMessageConnection(socket, socket)

      conn.onNotification(initNoti, clientId => {
        if (!this.conn && clientId === this.id) {
          logger.info('rpc setup')
          this.conn = conn
          resolve(true)
        } else {
          socket.destroySoon()
          resolve(false)
        }
      })

      conn.listen()

      socket.on('close', () => {
        logger.info('connection lost')
        if (conn == this.conn) {
          this.proc?.kill()
          this.proc?.clean?.()
          this.proc = undefined
          this.conn = undefined
        }
      })
    }

    this.server.once('connection', setupConnection)

    this.proc = new ProcessManager(this.script, this.admin)
    if (
      !(await this.proc.ensure(
        encodeParam({
          id: this.id,
          port: this.port,
          ...args
        })
      ))
    ) {
      this.proc.kill()
      this.proc.clean?.()
      this.proc = undefined
      this.server.removeListener('connection', setupConnection)
      return false
    }

    return promise
  }
}
