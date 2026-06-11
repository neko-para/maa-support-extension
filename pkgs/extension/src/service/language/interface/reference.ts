import * as vscode from 'vscode'

import { findDeclRef } from '@nekosu/maa-pipeline-manager-vnext'

import { autoConvertRangeLocation } from '../utils'
import { InterfaceLanguageProvider } from './base'

export class InterfaceReferenceProvider
  extends InterfaceLanguageProvider
  implements vscode.ReferenceProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerReferenceProvider(sel, this)
    })
  }

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
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

    const decls = this.makeDecls(snapshot, decl, ref) ?? []
    const refs = this.makeRefs(snapshot, decl, ref) ?? []
    return await Promise.all([...decls, ...refs].map(dr => autoConvertRangeLocation(dr)))
  }
}
