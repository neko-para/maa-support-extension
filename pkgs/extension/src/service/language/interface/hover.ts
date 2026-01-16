import * as vscode from 'vscode'

import { isString, parseObject } from '@mse/pipeline-manager/src/parser/utils'

import { interfaceService } from '../..'
import { findDeclRef } from '../utils'
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
      const content: string[] = []
      for (const [idx, loc] of (interfaceService.interfaceBundle?.langs ?? []).entries()) {
        const id = interfaceService.interfaceBundle?.langFiles[idx][0]
        if (!loc.node || !id) {
          continue
        }
        for (const [key, obj, prop] of parseObject(loc.node)) {
          if (key === ref.target && isString(obj)) {
            try {
              const doc = await vscode.workspace.openTextDocument(loc.file)
              const pos = doc.positionAt(obj.offset)
              content.push(
                `| [${id}](${vscode.Uri.file(loc.file)}#L${pos.line + 1}) | ${obj.value} |`
              )
            } catch {}
          }
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
