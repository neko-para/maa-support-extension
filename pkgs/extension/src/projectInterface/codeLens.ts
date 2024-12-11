import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'

export class ProjectInterfaceCodeLensProvider extends Service implements vscode.CodeLensProvider {
  bind?: vscode.Disposable

  didChangeCodeLenses: vscode.EventEmitter<void>
  onDidChangeCodeLenses: vscode.Event<void>

  constructor() {
    super()

    this.didChangeCodeLenses = new vscode.EventEmitter()
    this.onDidChangeCodeLenses = this.didChangeCodeLenses.event

    this.shared(PipelineRootStatusProvider).event.on('activateRootChanged', () => {
      this.setup()
    })

    this.setup()
  }

  setup() {
    this.bind?.dispose()

    const root = this.shared(PipelineRootStatusProvider).activateResource

    if (root) {
      this.bind = vscode.languages.registerCodeLensProvider(
        {
          pattern: new vscode.RelativePattern(root.dirUri, 'interface.json') // stupid, but just works
        },
        this
      )
    }
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
