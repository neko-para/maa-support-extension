import * as path from 'path'
import * as vscode from 'vscode'

import { interfaceService } from '../..'
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
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const index = await this.flushIndex()
    if (!index) {
      return []
    }

    const result: vscode.DocumentLink[] = []

    for (const ref of index.refs.filter(ref => ref.file === document.uri.fsPath)) {
      if (
        ref.type === 'interface.language_path' ||
        ref.type === 'interface.resource_path' ||
        ref.type === 'interface.import_path'
      ) {
        result.push(
          new vscode.DocumentLink(
            convertRange(document, ref.location),
            vscode.Uri.file(path.join(interfaceService.interfaceBundle!.root, ref.target))
          )
        )
      }
    }

    return result
  }
}
