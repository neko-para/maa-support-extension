import * as vscode from 'vscode'

import type { ExtToWeb } from '../../types/ipc'
import { commands } from '../command'
import { Service } from '../data'

export class ProjectInterfaceWebProvider extends Service {
  panel: vscode.WebviewPanel | null

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.panel = null

    this.defer = vscode.commands.registerCommand(commands.OpenWeb, async () => {
      ;(await this.acquire()).reveal()
    })
  }

  async acquire() {
    if (!this.panel) {
      const rootUri = vscode.Uri.file(this.__context.asAbsolutePath('web'))

      this.panel = vscode.window.createWebviewPanel(
        'maa.Webview',
        'Maa Support',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          localResourceRoots: [rootUri]
        }
      )
      this.panel.onDidDispose(() => {
        this.panel = null
      })
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, 'index.html'))
      )
        .toString()
        .replaceAll('/@ROOT@', this.panel.webview.asWebviewUri(rootUri).toString())
      this.panel.webview.html = content
    }
    return this.panel
  }

  async post(msg: ExtToWeb) {
    return await (await this.acquire()).webview.postMessage(msg)
  }
}
