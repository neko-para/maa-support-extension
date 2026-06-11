import * as vscode from 'vscode'

import { findDeclRef } from '@nekosu/maa-pipeline-manager-vnext'

import { autoConvertRangeLocation } from '../utils'
import { InterfaceLanguageProvider } from './base'

export class InterfaceDefinitionProvider
  extends InterfaceLanguageProvider
  implements vscode.DefinitionProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerDefinitionProvider(sel, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return null
    }

    const ifv = snapshot.interfaceFiles.find(f => f.path === document.uri.fsPath)
    if (!ifv) {
      return null
    }

    const offset = document.offsetAt(position)
    const decl = findDeclRef(ifv.decls, offset)
    const ref = findDeclRef(ifv.refs, offset)

    if (decl) {
      const decls = this.makeDecls(snapshot, decl, ref) ?? []
      const refs = this.makeRefs(snapshot, decl, ref) ?? []
      return await Promise.all([...decls, ...refs].map(dr => autoConvertRangeLocation(dr)))
    } else if (ref) {
      const decls = this.makeDecls(snapshot, decl, ref) ?? []
      return await Promise.all(decls.map(dr => autoConvertRangeLocation(dr)))
    }

    return null
  }
}
