import EventEmitter from 'node:events'
import * as net from 'node:net'
import { v4 } from 'uuid'
import * as rpc from 'vscode-jsonrpc/node'

import { initNoti, shutdownNoti } from '@nekosu/maa-server-proto'

import { logger } from '../../utils/logger'
import { ProcessManager } from './process'
import { makePromise, waitForConnection } from './promise'

const connectionTimeout = 60_000

function encodeParam(data: unknown) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

export class RpcManager extends EventEmitter<{
  connectionLost: []
}> {
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
    super()

    this.script = script
    this.admin = admin
    this.id = v4()
  }

  kill() {
    this.conn?.sendNotification(shutdownNoti)

    if (this.proc) {
      this.proc.kill()
      this.proc.clean?.()
      this.proc = undefined
    }

    this.server?.close()
    this.server = undefined
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
    let pendingSocket: net.Socket | undefined
    let attemptActive = true

    const setupConnection = (socket: net.Socket) => {
      logger.info('connection established')
      pendingSocket = socket
      const conn = rpc.createMessageConnection(socket, socket)

      conn.onNotification(initNoti, clientId => {
        if (attemptActive && !this.conn && clientId === this.id) {
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
          this.emit('connectionLost')
        } else if (attemptActive) {
          resolve(false)
        }
      })
    }

    this.server.once('connection', setupConnection)

    const proc = new ProcessManager(this.script, this.admin)
    this.proc = proc
    if (
      !(await proc.ensure(
        encodeParam({
          id: this.id,
          port: this.port,
          ...args
        })
      ))
    ) {
      attemptActive = false
      this.disposeConnectionAttempt(proc, setupConnection, pendingSocket)
      return false
    }

    const result = await waitForConnection(promise, proc.waitForClose(), connectionTimeout)
    attemptActive = false
    if (result === 'connected') {
      return true
    }

    if (result === 'timeout') {
      logger.error('Maa server connection timed out')
    } else if (result === 'process-exited') {
      logger.error('Maa server process exited before RPC setup')
    }
    this.disposeConnectionAttempt(proc, setupConnection, pendingSocket)
    return false
  }

  private disposeConnectionAttempt(
    proc: ProcessManager,
    setupConnection: (socket: net.Socket) => void,
    socket?: net.Socket
  ) {
    this.server?.removeListener('connection', setupConnection)
    socket?.destroy()
    proc.kill()
    proc.clean?.()
    if (this.proc === proc) {
      this.proc = undefined
    }
  }
}
