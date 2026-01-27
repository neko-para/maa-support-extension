import * as vscode from 'vscode'

import { findDeclRef } from '@mse/pipeline-manager'

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
    const index = await this.flushIndex()
    if (!index) {
      return null
    }

    const offset = document.offsetAt(position)
    const ref = findDeclRef(index.refs, offset)

    if (ref?.type === 'interface.locale') {
      const hover = await this.getLocaleHover(ref.target)
      if (hover) {
        return new vscode.Hover(hover)
      } else {
        return null
      }
    }

    return null
  }
}
