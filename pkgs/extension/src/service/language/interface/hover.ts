import * as vscode from 'vscode'

import { interfaceIndexService, interfaceLocalizationService, rootService } from '../..'
import { InterfaceLanguageProvider } from './base'

export class InterfaceHoverProvider
  extends InterfaceLanguageProvider
  implements vscode.HoverProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerHoverProvider(sel, this)
    })
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    if (document.uri.fsPath !== rootService.activeResource?.interfaceUri.fsPath) {
      return null
    }

    const info = await interfaceIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'locale.ref') {
      const content: string[] = []
      for (const [locale, index] of Object.entries(interfaceLocalizationService.localeIndex)) {
        if (info.value in index) {
          const uri = interfaceLocalizationService.activeConfig[locale]
          content.push(
            `| [${locale}](${uri.toString()}#L${index[info.value].propRange.start.line + 1}) | ${index[info.value].value} |`
          )
        }
      }
      if (content.length > 0) {
        return new vscode.Hover(`| locale | value |\n| --- | --- |\n${content.join('\n')}`)
      }
      return null
    }

    return null
  }
}
