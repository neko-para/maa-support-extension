import * as vscode from 'vscode'

import { Snapshot, findDeclRef } from '@nekosu/maa-pipeline-manager-vnext'

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
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<CustomCompletionItem[] | null> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return []
    }

    const ifv = snapshot.interfaceFiles.find(f => f.path === document.uri.fsPath)
    if (!ifv) {
      return null
    }

    const offset = document.offsetAt(position)
    const ref = findDeclRef(ifv.refs, offset)

    if (!ref) {
      return null
    }

    const allDecls = Snapshot.allInterfaceDecls(snapshot)

    if (ref.type === 'interface.controller') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls
        .filter(decl => decl.type === 'interface.controller')
        .map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.resource') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls
        .filter(decl => decl.type === 'interface.resource')
        .map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.task') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls.filter(decl => decl.type === 'interface.task').map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.group') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls.filter(decl => decl.type === 'interface.group').map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.option') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls.filter(decl => decl.type === 'interface.option').map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.case') {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls
        .filter(decl => decl.type === 'interface.case')
        .filter(decl => decl.option === ref.option)
        .map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    } else if (ref.type === 'interface.input' && ref.offset === undefined) {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      const opts = allDecls
        .filter(decl => decl.type === 'interface.input')
        .filter(decl => decl.option === ref.option)
        .map(decl => decl.name)
      return opts.map(name => ({
        label: name,
        kind: vscode.CompletionItemKind.Reference,
        insertText: JSON.stringify(name).slice(1, -1),
        range
      }))
    }

    return null
  }

  async resolveCompletionItem(
    item: CustomCompletionItem,
    _token: vscode.CancellationToken
  ): Promise<CustomCompletionItem> {
    if (item.fillDetail) {
      item.documentation = new vscode.MarkdownString(await item.fillDetail())
    }
    return item
  }
}
