import * as vscode from 'vscode'

import { BundleView, FileViewUtils, Snapshot, nodePathUtils } from '@nekosu/maa-pipeline-manager-vnext'

import { isMaaAssistantArknights } from '../../../utils/fs'
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
    _token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return []
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return []
    }
    const { bundle, file } = located

    const refs = FileViewUtils.allRefs(file)

    const imageFolders = Snapshot.getImageFolders(snapshot)

    const result: vscode.DocumentLink[] = []
    for (const ref of refs) {
      if (
        (ref.type === 'task.can_locale' || ref.type === 'task.locale_text') &&
        (ref.target.endsWith('.md') || ref.target.endsWith('.png'))
      ) {
        const full = nodePathUtils.join(bundle.root, ref.target)
        result.push(
          new vscode.DocumentLink(convertRange(document, ref.location), vscode.Uri.file(full))
        )
        continue
      }

      if (ref.type !== 'task.template' && ref.type !== 'task.custom_template') {
        continue
      }
      if (!ref.target.endsWith('.png')) {
        if (isMaaAssistantArknights) {
          continue
        }
        const normImg = ref.target
        if (imageFolders.has(normImg)) {
          const bundles = imageFolders.get(normImg)!
          const firstBundle = bundles[0]
          result.push(
            new vscode.DocumentLink(
              convertRange(document, ref.location),
              vscode.Uri.file(BundleView.imagePath(firstBundle, nodePathUtils, normImg))
            )
          )
        }
        continue
      }

      const layers = Snapshot.getImage(snapshot, nodePathUtils, ref.target)
      for (const { absPath } of layers) {
        result.push(
          new vscode.DocumentLink(convertRange(document, ref.location), vscode.Uri.file(absPath))
        )
        break
      }
    }

    return result
  }
}
