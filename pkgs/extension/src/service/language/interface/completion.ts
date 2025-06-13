import * as vscode from 'vscode'

import { interfaceIndexService } from '../..'
import { InterfaceLanguageProvider } from './base'

export class InterfaceCompletionProvider
  extends InterfaceLanguageProvider
  implements vscode.CompletionItemProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerCompletionItemProvider(sel, this, '"')
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
    const info = await interfaceIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      return interfaceIndexService.optionDecl.map(decl => {
        const esc = JSON.stringify(decl.option)
        return {
          label: esc,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(0, esc.length - 1),
          range: new vscode.Range(info.range.start, info.range.end.translate(0, -1))
        }
      })
    }

    return null
  }
}
