import * as vscode from 'vscode'

import { nodePathUtils } from '@nekosu/maa-pipeline-manager-vnext'

import { convertRange } from '../utils'
import { InterfaceLanguageProvider } from './base'

export class InterfaceDocumentLinkProvider
  extends InterfaceLanguageProvider
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

    const ifv = snapshot.interfaceFiles.find(f => f.path === document.uri.fsPath)
    if (!ifv) {
      return []
    }

    const result: vscode.DocumentLink[] = []
    const root = nodePathUtils.dirname(snapshot.interfaceFile)

    for (const ref of ifv.refs) {
      if (
        ref.type === 'interface.language_path' ||
        ref.type === 'interface.resource_path' ||
        ref.type === 'interface.import_path'
      ) {
        result.push(
          new vscode.DocumentLink(
            convertRange(document, ref.location),
            vscode.Uri.file(nodePathUtils.join(root, ref.target))
          )
        )
      }
    }

    return result
  }
}
