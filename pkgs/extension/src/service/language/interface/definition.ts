import * as vscode from 'vscode'

import { interfaceIndexService, rootService } from '../..'
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
    await interfaceIndexService.flushDirty()

    const info = await interfaceIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      const optionInfo = interfaceIndexService.optionDecl.find(x => x.option === info.option)
      return optionInfo
        ? new vscode.Location(rootService.activeResource!.interfaceUri, optionInfo.range)
        : null
    } else if (info.type === 'case.ref') {
      const caseInfo = interfaceIndexService.caseDecl.find(
        x => x.option === info.option && x.case === info.case
      )
      return caseInfo
        ? new vscode.Location(rootService.activeResource!.interfaceUri, caseInfo.range)
        : null
    }

    return null
  }
}
