import * as vscode from 'vscode'

import { findDeclRef } from '@mse/pipeline-manager'

import { convertRangeLocation } from '../utils'
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
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    const index = await this.flushIndex()
    if (!index) {
      return null
    }

    const offset = document.offsetAt(position)
    const decl = findDeclRef(index.decls, offset)
    const ref = findDeclRef(index.refs, offset)

    const decls = this.makeDecls(index, decl, ref) ?? []
    const refs = this.makeRefs(index, decl, ref) ?? []
    return [...decls, ...refs].map(dr => convertRangeLocation(document, dr.location))
  }
}
