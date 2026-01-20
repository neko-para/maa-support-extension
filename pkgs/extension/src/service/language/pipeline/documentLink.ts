import * as vscode from 'vscode'

import { AbsolutePath, joinImagePath } from '@mse/pipeline-manager'

import { convertRange } from '../utils'
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
    const intBundle = await this.flush()
    if (!intBundle) {
      return []
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return []
    }
    const [layer, file] = layerInfo

    const refs = layer.mergedRefs.filter(ref => ref.file === file)

    const result: vscode.DocumentLink[] = []
    for (const ref of refs) {
      if (ref.type !== 'task.template') {
        continue
      }

      result.push(
        new vscode.DocumentLink(
          convertRange(document, ref.location),
          vscode.Uri.file(joinImagePath(layer.root, ref.target))
        )
      )
    }

    return result
  }
}
