import * as vscode from 'vscode'

export type WebviewOption = {
  context: vscode.ExtensionContext
  folder: string
  urlPath: string
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

    const webRoot = vscode.Uri.joinPath(this.option.context.extensionUri, this.option.folder)
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
