import * as vscode from 'vscode'

import { findDeclRef } from '@mse/pipeline-manager'

import { interfaceService } from '../..'
import { convertRangeWithDelta } from '../utils'
import { InterfaceLanguageProvider } from './base'

type CustomCompletionItem = vscode.CompletionItem & {
  fillDetail?: () => Promise<string>
}

export class InterfaceCompletionProvider
  extends InterfaceLanguageProvider
  implements vscode.CompletionItemProvider<CustomCompletionItem>
{
  constructor() {
    super(sel => {
      return vscode.languages.registerCompletionItemProvider(sel, this, ...'"'.split(''))
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<CustomCompletionItem[] | null> {
    const index = await this.flushIndex()
    if (!index) {
      return []
    }

    const offset = document.offsetAt(position)
    const ref = findDeclRef(
      index.refs.filter(ref => ref.file === document.uri.fsPath),
      offset
    )

    if (!ref) {
      return null
    }

    if (ref.type === 'interface.option') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)

      const opts = index.decls
        .filter(decl => decl.type === 'interface.option')
        .map(decl => decl.name)
      return opts.map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(1, esc.length - 1),
          range
        }
      })
    } else if (ref.type === 'interface.controller') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)

      const opts = index.decls
        .filter(decl => decl.type === 'interface.controller')
        .map(decl => decl.name)
      return opts.map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(1, esc.length - 1),
          range
        }
      })
    } else if (ref.type === 'interface.resource') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)

      const opts = index.decls
        .filter(decl => decl.type === 'interface.resource')
        .map(decl => decl.name)
      return opts.map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(1, esc.length - 1),
          range
        }
      })
    }

    return null
  }

  async resolveCompletionItem(
    item: CustomCompletionItem,
    token: vscode.CancellationToken
  ): Promise<CustomCompletionItem> {
    if (item.fillDetail) {
      item.documentation = new vscode.MarkdownString(await item.fillDetail())
    }
    return item
  }
}
