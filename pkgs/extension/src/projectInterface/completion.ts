import * as vscode from 'vscode'

import { ProjectInterfaceIndexerProvider } from './indexer'
import { ProviderBase } from './providerBase'

export class ProjectInterfaceCompletionProvider
  extends ProviderBase
  implements vscode.CompletionItemProvider
{
  constructor() {
    super(selector => {
      return vscode.languages.registerCompletionItemProvider(selector, this, '"')
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
    const info = await this.shared(ProjectInterfaceIndexerProvider).queryLocation(
      document.uri,
      position
    )

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      return this.shared(ProjectInterfaceIndexerProvider).optionDecl.map(decl => {
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

  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item
  }
}
