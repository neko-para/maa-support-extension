/**
 * Partial impl of json-rpc 2.0
 *
 * jsonrpc label removed.
 * object params removed.
 * notification removed.
 * error & batch mode removed.
 */

export type JsonValue = null | boolean | string | number | JsonArray | JsonObject
export type JsonArray = JsonValue[]
export type JsonObject = {
  [key in string]: JsonValue
}

export type RpcRequest = {
  req: true

  method: string
  params: JsonArray
  id: number
}

export type RpcResponse = {
  req: false

  result: JsonValue
  id: number
}

export type RpcServerAdapter = {
  readonly send: (rsp: RpcResponse) => void
  recv: (req: RpcRequest) => void
}

export type RpcClientAdapter = {
  readonly send: (req: RpcRequest) => void
  recv: (rsp: RpcResponse) => void
}

export type RpcService = (method: string, ...args: JsonArray) => Promise<JsonValue>
