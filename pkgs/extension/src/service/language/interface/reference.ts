import * as vscode from 'vscode'

import { interfaceIndexService, rootService } from '../..'
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
    await interfaceIndexService.flushDirty()

    const info = await interfaceIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      const result: vscode.Location[] = []
      const decl = interfaceIndexService.optionDecl.find(x => x.option === info.option)
      for (const ref of interfaceIndexService.refs) {
        if (
          ref.type === 'option.ref' &&
          ref.option === info.option &&
          (!decl || !ref.range.isEqual(decl.range))
        ) {
          result.push(new vscode.Location(rootService.activeResource!.interfaceUri, ref.range))
        }
      }
      return result
    } else if (info.type === 'option.ref.advanced') {
      const result: vscode.Location[] = []
      const decl = interfaceIndexService.advancedOptionDecl.find(x => x.option === info.option)
      for (const ref of interfaceIndexService.refs) {
        if (
          ref.type === 'option.ref.advanced' &&
          ref.option === info.option &&
          (!decl || !ref.range.isEqual(decl.range))
        ) {
          result.push(new vscode.Location(rootService.activeResource!.interfaceUri, ref.range))
        }
      }
      return result
    }

    return null
  }
}
