import * as vscode from 'vscode'

import type { RpcClientAdapter, RpcRequest, RpcResponse, RpcServerAdapter } from '../../uni/rpc'

export const forwardIframe = (url: string) => {
  return `
<html>
  <head>
    <style>
      body {
        padding: 0;
      }
      iframe {
        position: fixed;
        width: 100%;
        height: 100%;
        border-width: 0;
      }
    </style>
  </head>
  <body>
    <iframe src="${url}"></iframe>
  </body>
</html>
`
}

export const cspMeta = (cspSource: string) => {
  return `
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; font-src ${cspSource}; style-src 'unsafe-inline' ${cspSource}; script-src ${cspSource}; img-src ${cspSource} data:; connect-src ${cspSource} data:;"
/>
`
}

export function makeWebAdapter(view: vscode.Webview): [RpcServerAdapter, RpcClientAdapter] {
  const server: RpcServerAdapter = {
    send: rsp => {
      view.postMessage(JSON.stringify(rsp))
    },
    recv: () => {}
  }
  const client: RpcClientAdapter = {
    send: req => {
      view.postMessage(JSON.stringify(req))
    },
    recv: () => {}
  }

  view.onDidReceiveMessage((data: string) => {
    const msg = JSON.parse(data) as RpcRequest | RpcResponse
    if (msg.req) {
      server.recv(msg)
    } else {
      client.recv(msg)
    }
  })

  return [server, client]
}
