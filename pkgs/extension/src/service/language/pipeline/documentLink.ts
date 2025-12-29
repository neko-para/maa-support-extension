import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { isMaaAssistantArknights } from '../../../utils/fs'
import { PipelineLanguageProvider } from './base'

export class PipelineDocumentLinkProvider
  extends PipelineLanguageProvider
  implements vscode.DocumentLinkProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerDocumentLinkProvider(sel, this)
    })
  }

  async provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    if (this.shouldFilter(document)) {
      return []
    }

    await taskIndexService.flushDirty()

    if (isMaaAssistantArknights) {
      await taskIndexService.flushImage()
    }

    const result: vscode.DocumentLink[] = []

    const layer = taskIndexService.getLayer(document.uri)
    if (!layer) {
      return result
    }

    for (const [task, infos] of Object.entries(layer.index)) {
      for (const info of infos) {
        if (info.uri.fsPath !== document.uri.fsPath) {
          continue
        }

        for (const ref of info.imageRef) {
          const ii = await taskIndexService.queryImage(ref.path, layer.level + 1)
          if (ii.length > 0) {
            result.push(new vscode.DocumentLink(ref.range, ii[ii.length - 1].info.uri))
          }
        }
      }
    }

    return result
  }
}
