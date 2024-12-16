import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { ProviderBase } from './providerBase'

export class ProjectInterfaceCodeLensProvider
  extends ProviderBase
  implements vscode.CodeLensProvider
{
  didChangeCodeLenses: vscode.EventEmitter<void>
  onDidChangeCodeLenses: vscode.Event<void>

  constructor() {
    super(selector => {
      return vscode.languages.registerCodeLensProvider(selector, this)
    })

    this.didChangeCodeLenses = new vscode.EventEmitter()
    this.onDidChangeCodeLenses = this.didChangeCodeLenses.event

    this.shared(PipelineProjectInterfaceProvider).event.on('activateInterfaceChanged', () => {
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
          const activated =
            this.shared(PipelineProjectInterfaceProvider).interfaceConfigJson?.resource === value
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

  resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens
  }
}
