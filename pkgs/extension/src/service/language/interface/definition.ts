import * as vscode from 'vscode'

import { convertRangeLocation, findDeclRef } from '../utils'
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
    const decl = findDeclRef(index.decls, offset)
    const ref = findDeclRef(index.refs, offset)

    if (decl) {
      const decls = this.makeDecls(index, decl, ref) ?? []
      const refs = this.makeRefs(index, decl, ref) ?? []
      return [...decls, ...refs].map(dr => convertRangeLocation(document, dr.location))
    } else if (ref) {
      const decls = this.makeDecls(index, decl, ref) ?? []
      return decls.map(dr => convertRangeLocation(document, dr.location))
    }

    return []

    // TODO: locale

    /*
    await interfaceIndexService.flushDirty()

    const info = await interfaceIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'locale.ref') {
      const result: vscode.Definition = []
      for (const [locale, index] of Object.entries(interfaceLocalizationService.localeIndex)) {
        if (info.value in index) {
          result.push(
            new vscode.Location(
              interfaceLocalizationService.activeConfig[locale],
              index[info.value].propRange
            )
          )
        }
      }
      return result
    }

    */

    return null
  }
}
