import * as vscode from 'vscode'

import { logger, visitJsonDocument } from '@mse/utils'

import { interfaceService } from '../..'
import { commands } from '../../../command'
import { InterfaceLanguageProvider } from './base'

export class InterfaceCodeLensProvider
  extends InterfaceLanguageProvider
  implements vscode.CodeLensProvider
{
  didChangeCodeLenses: vscode.EventEmitter<void>
  get onDidChangeCodeLenses() {
    return this.didChangeCodeLenses.event
  }

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })

    this.didChangeCodeLenses = new vscode.EventEmitter()

    interfaceService.onInterfaceChanged(() => {
      logger.debug('interface codelens refresh')
      this.didChangeCodeLenses.fire()
    })
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const result: vscode.CodeLens[] = []
    visitJsonDocument(document, {
      onObjectProp: (prop, range, path) => {},
      onLiteral: (value, range, path) => {
        if (
          path.length === 3 &&
          path[0] === 'resource' &&
          typeof path[1] === 'number' &&
          path[2] === 'name'
        ) {
          const activated = interfaceService.interfaceConfigJson.resource === value
          result.push(
            activated
              ? new vscode.CodeLens(range, {
                  title: '已激活',
                  command: ''
                })
              : new vscode.CodeLens(range, {
                  title: '切换',
                  command: commands.PISwitchResource,
                  arguments: [value]
                })
          )
        }
      }
    })
    return result
  }
}
