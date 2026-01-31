import * as vscode from 'vscode'

import { AbsolutePath } from '@mse/pipeline-manager'

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
    const topLayer = intBundle.topLayer

    const refs = layer.mergedRefs.filter(ref => ref.file === file)

    const result: vscode.DocumentLink[] = []
    for (const ref of refs) {
      if (ref.type !== 'task.template') {
        continue
      }
      if (!ref.target.endsWith('.png')) {
        continue
      }

      const layers = topLayer.getImage(ref.target)
      for (const [, full] of layers) {
        result.push(
          new vscode.DocumentLink(convertRange(document, ref.location), vscode.Uri.file(full))
        )
        break // 只要最顶层的最匹配的那个
      }
    }

    return result
  }
}
