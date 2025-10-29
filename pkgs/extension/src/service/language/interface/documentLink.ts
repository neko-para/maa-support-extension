import * as vscode from 'vscode'

import { interfaceIndexService, rootService } from '../..'
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
    if (document.uri.fsPath !== rootService.activeResource?.interfaceUri.fsPath) {
      return []
    }

    await interfaceIndexService.flushDirty()

    const result: vscode.DocumentLink[] = []

    for (const decl of interfaceIndexService.localeDecl) {
      result.push(
        new vscode.DocumentLink(
          decl.range,
          vscode.Uri.joinPath(rootService.activeResource.dirUri, decl.file)
        )
      )
    }

    return result
  }
}
