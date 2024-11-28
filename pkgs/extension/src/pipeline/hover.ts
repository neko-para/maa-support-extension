import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineHoverProvider extends ProviderBase implements vscode.HoverProvider {
  constructor() {
    super(selector => {
      return vscode.languages.registerHoverProvider(selector, this)
    })
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      return new vscode.Hover(
        await this.shared(PipelineTaskIndexProvider).queryTaskDoc(info.target)
      )
    } else if (info.type === 'image.ref') {
      return new vscode.Hover(
        await this.shared(PipelineTaskIndexProvider).queryImageDoc(info.target)
      )
    }

    return null
  }
}
