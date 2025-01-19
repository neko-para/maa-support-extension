import type { RpcClientAdapter, RpcRequest, RpcResponse, RpcServerAdapter } from '@uni/rpc'

export function makeAdapter(socket: WebSocket): [RpcServerAdapter, RpcClientAdapter] {
  const server: RpcServerAdapter = {
    send: rsp => {
      socket.send(JSON.stringify(rsp))
    },
    recv: () => {}
  }
  const client: RpcClientAdapter = {
    send: req => {
      socket.send(JSON.stringify(req))
    },
    recv: () => {}
  }

  socket.onmessage = ev => {
    const msg = JSON.parse(ev.data) as RpcRequest | RpcResponse
    if (msg.req) {
      server.recv(msg)
    } else {
      client.recv(msg)
    }
  }

  return [server, client]
}
