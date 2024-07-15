import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineHoverProvider extends ProviderBase implements vscode.HoverProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
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
      try {
        await vscode.workspace.fs.stat(info.target)
        return new vscode.Hover(new vscode.MarkdownString(`![](${info.target})`))
      } catch (_) {
        return new vscode.Hover(
          new vscode.MarkdownString(
            vscode.l10n.t(
              'maa.pipeline.error.not-exists',
              this.shared(PipelineRootStatusProvider).relativePath(info.target)
            )
          )
        )
      }
    }

    return null
  }
}
