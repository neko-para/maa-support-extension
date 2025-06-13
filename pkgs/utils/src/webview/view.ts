import * as fs from 'fs/promises'
import * as vscode from 'vscode'

import forwardHtml from './forwardHtml.html'

const cspMeta = `<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'none'; font-src %{cspSource}; style-src 'unsafe-inline' %{cspSource}; script-src %{cspSource}; img-src %{cspSource} data:; connect-src %{cspSource} data:;"
/>`

export type WebviewOption = {
  context: vscode.ExtensionContext
  folder: string
  index: string
  webId: string
  dev: boolean
}

class WebviewProvider implements vscode.WebviewViewProvider {
  option: WebviewOption

  webview?: vscode.Webview
  visible: boolean = false

  constructor(option: WebviewOption) {
    this.option = option
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Thenable<void> | void {
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

    this.loadContent()
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

  recv(data: unknown) {}

  send(data: unknown) {
    this.webview?.postMessage(JSON.stringify(data))
  }
}

export function provideWebview(option: WebviewOption) {
  option.context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(option.webId, new WebviewProvider(option), {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  )
}
