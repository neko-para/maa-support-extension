import type { JsonValue, RpcClientAdapter, RpcServerAdapter, RpcService } from './types'

export type * from './types'

export class RpcServer {
  adapter: RpcServerAdapter
  service: RpcService

  constructor(adapter: RpcServerAdapter, service: RpcService) {
    this.adapter = adapter
    this.service = service

    this.adapter.recv = req => {
      service(req.method, ...req.params).then(result => {
        this.adapter.send({
          req: false,
          result,
          id: req.id
        })
      })
    }
  }
}

export class RpcClient {
  adapter: RpcClientAdapter
  _id: number
  _cache: Map<number, (result: JsonValue) => void>

  service: RpcService

  constructor(adapter: RpcClientAdapter) {
    this.adapter = adapter
    this._id = 0
    this._cache = new Map()

    this.adapter.recv = rsp => {
      const resolve = this._cache.get(rsp.id)
      this._cache.delete(rsp.id)
      resolve?.(rsp.result)
    }
    this.service = async (method, ...args) => {
      const id = this._id++
      this.adapter.send({
        req: true,
        method,
        params: args,
        id
      })
      return new Promise<JsonValue>(resolve => {
        this._cache.set(id, resolve)
      })
    }
  }
}

export type RpcContext = [RpcServer, RpcClient, RpcService]

export function rpcSetup(
  service: RpcService,
  serverAdapter: RpcServerAdapter,
  clientAdapter: RpcClientAdapter
): RpcContext {
  const server = new RpcServer(serverAdapter, service)
  const client = new RpcClient(clientAdapter)
  return [server, client, client.service]
}
