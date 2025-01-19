import { type RpcContext, rpcSetup } from '@uni/rpc'
import * as vscode from 'vscode'
import { type AddressInfo, WebSocketServer } from 'ws'

import { makeAdapter } from '@/rpc'

import { forwardIframe, withResolvers } from './utils'

export type VscodePanelMeta = {
  viewType: string
}

export class VscodePanel {
  panel: vscode.WebviewPanel

  static makePanel(
    viewType: string,
    title: string,
    viewColumn: vscode.ViewColumn,
    root: vscode.Uri,
    retain = true
  ) {
    return vscode.window.createWebviewPanel(viewType, title, viewColumn, {
      enableScripts: true,
      localResourceRoots: [root],
      retainContextWhenHidden: retain
    })
  }

  constructor(panel: vscode.WebviewPanel) {
    this.panel = panel
  }

  async setupDevelop(root: vscode.Uri, devUrl: vscode.Uri) {
    const server = new WebSocketServer({
      port: 0
    })

    const [rpcPromise, rpcResolve] = withResolvers<RpcContext>()
    server.once('connection', conn => {
      const rpc = rpcSetup(
        async () => {
          return 0
        },
        ...makeAdapter(conn)
      )
      rpcResolve(rpc)
    })

    const port = (server.address() as AddressInfo).port
    this.panel.webview.html = forwardIframe(
      devUrl
        .with({
          query: `vwp=${port}`
        })
        .toString()
    )

    this.panel.onDidDispose(() => {})

    return rpcPromise
  }
}
