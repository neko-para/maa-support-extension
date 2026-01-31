import * as vscode from 'vscode'

import { findDeclRef, parseObject } from '@mse/pipeline-manager'

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
        for (const loc of interfaceService.interfaceBundle?.langs ?? []) {
          if (!loc.node) {
            continue
          }
          for (const [key, obj, prop] of parseObject(loc.node)) {
            if (key === ref.target) {
              try {
                const doc = await vscode.workspace.openTextDocument(loc.file)
                result.push(convertRangeLocation(doc, prop))
              } catch {}
            }
          }
        }
        return result
      }

      const decls = this.makeDecls(index, decl, ref) ?? []
      return await Promise.all(decls.map(dr => autoConvertRangeLocation(dr)))
    }

    return null
  }
}
