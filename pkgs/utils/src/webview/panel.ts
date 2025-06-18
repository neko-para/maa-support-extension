import * as fs from 'fs/promises'
import * as vscode from 'vscode'

import { HostToWeb, ImplType, WebToHost } from '@mse/types'

import { cspMeta } from './data'
import forwardHtml from './forward.html'

export type WebviewPanelOption = {
  context: vscode.ExtensionContext
  folder: string
  index: string
  webId: string
  title: string
  viewColumn: vscode.ViewColumn
  preserveFocus: boolean
  dev: boolean
}

export class WebviewPanelProvider<ToWebImpl extends ImplType, ToHostImpl extends ImplType>
  implements vscode.Disposable
{
  option: WebviewPanelOption
  panel: vscode.WebviewPanel
  inited: Promise<void>
  initResolve?: () => void

  constructor(option: WebviewPanelOption) {
    this.option = option
    this.panel = vscode.window.createWebviewPanel(
      option.webId,
      option.title,
      {
        viewColumn: option.viewColumn,
        preserveFocus: option.preserveFocus
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )
    this.inited = new Promise(resolve => {
      this.initResolve = resolve
    })

    this.option.context.subscriptions.push(
      this.panel.onDidDispose(() => {
        this.dispose()
      })
    )

    this.option.context.subscriptions.push(
      this.panel.webview.onDidReceiveMessage(event => {
        if (typeof event !== 'string') {
          return
        }

        this.recv(JSON.parse(event))
      })
    )
  }

  dispose() {}

  async init() {
    await this.loadContent()

    await this.inited
  }

  async loadContent() {
    if (this.option.dev) {
      this.panel.webview.html = forwardHtml.replace(
        '%DEV_URL%',
        `http://localhost:5173/${this.option.index}`
      )
    } else {
      const webRoot = vscode.Uri.joinPath(this.option.context.extensionUri, this.option.folder)
      const webRootUri = this.panel.webview.asWebviewUri(webRoot)

      const htmlUri = vscode.Uri.joinPath(webRoot, `${this.option.index}.html`)
      const content = (await fs.readFile(htmlUri.fsPath, 'utf8'))
        .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
        .replace(
          '</title>',
          '</title>' + cspMeta.replaceAll('%{cspSource}', this.panel.webview.cspSource)
        )

      this.panel.webview.html = content
    }
  }

  recv(data: WebToHost<ToHostImpl>) {
    if (data.builtin) {
      switch (data.command) {
        case '__init':
          this.initResolve?.()
          break
      }
    }
  }

  send(data: HostToWeb<ToWebImpl>) {
    this.panel.webview.postMessage(JSON.stringify(data))
  }

  response(seq: number | undefined, data: unknown) {
    if (seq) {
      this.send({
        command: '__response',
        seq,
        data,
        builtin: true
      })
    }
  }
}
