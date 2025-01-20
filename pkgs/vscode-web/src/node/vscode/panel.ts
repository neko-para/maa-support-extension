import * as vscode from 'vscode'
import { type AddressInfo, WebSocketServer } from 'ws'

import { type RpcContext, type RpcService, rpcSetup } from '../../uni/rpc'
import { withResolvers } from '../../uni/utils'
import { makeWsAdapter } from '../rpc'
import { cspMeta, forwardIframe, makeWebAdapter } from './utils'

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

  async setupDevelop(service: RpcService, devUrl: vscode.Uri): Promise<RpcContext> {
    const server = new WebSocketServer({
      port: 0
    })

    const [rpcPromise, rpcResolve] = withResolvers<RpcContext>()
    server.once('connection', conn => {
      const rpc = rpcSetup(service, ...makeWsAdapter(conn))
      rpcResolve(rpc)
    })

    const port = (server.address() as AddressInfo).port
    // https://github.com/microsoft/vscode/issues/238267
    this.panel.webview.html = forwardIframe(devUrl.toString() + `?vwp=${port}`)

    this.panel.onDidDispose(() => {})

    return rpcPromise
  }

  async setupProduct(service: RpcService, root: vscode.Uri, html: vscode.Uri, fixCodicon = true) {
    const webRoot = this.panel.webview.asWebviewUri(root)
    let htmlContent = (await vscode.workspace.fs.readFile(html))
      .toString()
      .replace('</title>', '</title>' + cspMeta(this.panel.webview.cspSource))
      .replaceAll('="./assets', `="${webRoot.toString()}/assets`)
    if (fixCodicon) {
      htmlContent = htmlContent.replaceAll(
        'rel="stylesheet" crossorigin href=',
        'rel="stylesheet" crossorigin id="vscode-codicon-stylesheet" href='
      )
    }
    this.panel.webview.html = htmlContent

    this.panel.onDidDispose(() => {})

    return rpcSetup(service, ...makeWebAdapter(this.panel.webview))
  }
}
