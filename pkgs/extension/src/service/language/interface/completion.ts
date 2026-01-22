import * as vscode from 'vscode'

import { findDeclRef } from '@mse/pipeline-manager'

import { convertRangeWithDelta } from '../utils'
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
    const index = await this.flushIndex()
    if (!index) {
      return []
    }

    const offset = document.offsetAt(position)
    const ref = findDeclRef(index.refs, offset)

    if (!ref) {
      return null
    }

    if (ref.type === 'interface.option') {
      const range = convertRangeWithDelta(document, ref.location, -1)

      const opts = index.decls
        .filter(decl => decl.type === 'interface.option')
        .map(decl => decl.name)
      return opts.map(name => {
        const esc = JSON.stringify(name)
        return {
          label: esc,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(0, esc.length - 1),
          range
        }
      })
    }

    return null
  }
}
