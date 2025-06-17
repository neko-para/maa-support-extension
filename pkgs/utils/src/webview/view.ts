import * as fs from 'fs/promises'
import * as vscode from 'vscode'

import { HostToWeb, ImplType, WebToHost } from '@mse/types'

import { cspMeta } from './data'
import forwardHtml from './forward.html'

export type WebviewOption = {
  context: vscode.ExtensionContext
  folder: string
  index: string
  webId: string
  dev: boolean
}

export class WebviewProvider<ToWebImpl extends ImplType, ToHostImpl extends ImplType>
  implements vscode.WebviewViewProvider
{
  option: WebviewOption

  webview?: vscode.Webview
  visible: boolean = false

  constructor(option: WebviewOption) {
    this.option = option
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.webview = webviewView.webview

    webviewView.webview.html = 'loading...'
    webviewView.webview.options = {
      enableScripts: true
    }

    this.option.context.subscriptions.push(
      webviewView.onDidChangeVisibility(() => {
        this.visible = webviewView.visible
      })
    )

    this.option.context.subscriptions.push(
      webviewView.webview.onDidReceiveMessage(event => {
        if (typeof event !== 'string') {
          return
        }

        this.recv(JSON.parse(event))
      })
    )

    await this.loadContent()
  }

  async loadContent() {
    if (!this.webview) {
      return
    }

    if (this.option.dev) {
      this.webview.html = forwardHtml.replace(
        '%DEV_URL%',
        `http://localhost:5173/${this.option.index}`
      )
    } else {
      const webRoot = vscode.Uri.joinPath(this.option.context.extensionUri, this.option.folder)
      const webRootUri = this.webview.asWebviewUri(webRoot)

      const htmlUri = vscode.Uri.joinPath(webRoot, `${this.option.index}.html`)
      const content = (await fs.readFile(htmlUri.fsPath, 'utf8'))
        .replaceAll('="./assets', `="${webRootUri.toString()}/assets`)
        .replace(
          '</title>',
          '</title>' + cspMeta.replaceAll('%{cspSource}', this.webview.cspSource)
        )

      this.webview.html = content
    }
  }

  recv(data: WebToHost<ToHostImpl>) {}

  send(data: HostToWeb<ToWebImpl>) {
    this.webview?.postMessage(JSON.stringify(data))
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

export function provideWebview<ToWebImpl extends ImplType, ToHostImpl extends ImplType>(
  option: WebviewOption
) {
  const provider = new WebviewProvider<ToWebImpl, ToHostImpl>(option)

  option.context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(option.webId, provider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  )

  return provider
}
