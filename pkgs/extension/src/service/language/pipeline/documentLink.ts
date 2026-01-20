import * as path from 'path'
import * as vscode from 'vscode'

import { AbsolutePath, joinImagePath, joinPath } from '@mse/pipeline-manager'

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

    const [decls, refs] = layer.mergeDeclsRefs(file)

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

    /*
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
*/
    return result
  }
}
