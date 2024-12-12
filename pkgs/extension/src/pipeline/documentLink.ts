import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineDocumentLinkProvider
  extends ProviderBase
  implements vscode.DocumentLinkProvider
{
  constructor() {
    super(selector => {
      return vscode.languages.registerDocumentLinkProvider(selector, this)
    })
  }

  async provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const result: vscode.DocumentLink[] = []

    const layer = this.shared(PipelineTaskIndexProvider).getLayer(document.uri)
    if (!layer) {
      return result
    }

    await layer.flushDirty()

    for (const [task, info] of Object.entries(layer.taskIndex)) {
      if (info.uri.fsPath !== document.uri.fsPath) {
        continue
      }

      for (const ref of info.imageRef) {
        const ii = await this.shared(PipelineTaskIndexProvider).queryImage(
          ref.path,
          layer.level + 1
        )
        if (ii.length > 0) {
          result.push(new vscode.DocumentLink(ref.range, ii[ii.length - 1].info.uri))
        }
      }
    }

    return result
  }
}
