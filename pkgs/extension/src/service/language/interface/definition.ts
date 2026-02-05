import * as vscode from 'vscode'

import { findDeclRef, joinPath, parseObject } from '@mse/pipeline-manager'

import { interfaceService } from '../..'
import { autoConvertRangeLocation, convertRangeLocation } from '../utils'
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
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const index = await this.flushIndex()
    if (!index) {
      return null
    }

    const offset = document.offsetAt(position)
    const decl = findDeclRef(
      index.decls.filter(decl => decl.file === document.uri.fsPath),
      offset
    )
    const ref = findDeclRef(
      index.refs.filter(ref => ref.file === document.uri.fsPath),
      offset
    )

    if (decl) {
      const decls = this.makeDecls(index, decl, ref) ?? []
      const refs = this.makeRefs(index, decl, ref) ?? []
      return await Promise.all([...decls, ...refs].map(dr => autoConvertRangeLocation(dr)))
    } else if (ref) {
      if (ref.type === 'interface.locale') {
        const result: vscode.Definition = []
        const langBundle = interfaceService.interfaceBundle!.langBundle
        for (const [index, entry] of langBundle.queryKey(ref.target).entries()) {
          if (!entry) {
            continue
          }

          const lang = langBundle.langs[index]
          const doc = await vscode.workspace.openTextDocument(joinPath(langBundle.root, lang.file))
          result.push(convertRangeLocation(doc, entry.keyNode))
        }
        return result
      }

      const decls = this.makeDecls(index, decl, ref) ?? []
      return await Promise.all(decls.map(dr => autoConvertRangeLocation(dr)))
    }

    return null
  }
}
