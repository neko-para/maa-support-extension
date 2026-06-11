import * as vscode from 'vscode'

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
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    return null
  }
}
