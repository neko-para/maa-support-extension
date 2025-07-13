import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { interfaceIndexService, interfaceService } from '../..'
import { commands } from '../../../command'
import { debounce } from '../../utils/debounce'
import { InterfaceLanguageProvider } from './base'

export class InterfaceCodeLensProvider
  extends InterfaceLanguageProvider
  implements vscode.CodeLensProvider
{
  didChangeCodeLenses: vscode.EventEmitter<void>
  get onDidChangeCodeLenses() {
    return this.didChangeCodeLenses.event
  }

  fireChangeCodeLenses: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })

    this.didChangeCodeLenses = new vscode.EventEmitter()

    this.fireChangeCodeLenses = debounce(() => {
      this.didChangeCodeLenses.fire()
    }, 50)

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.fireChangeCodeLenses()
    })
    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.fireChangeCodeLenses()
    })
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    await interfaceIndexService.flushDirty()

    const result: vscode.CodeLens[] = []
    for (const decl of interfaceIndexService.resourceDecl) {
      const activated = interfaceService.interfaceConfigJson.resource === decl.name
      result.push(
        activated
          ? new vscode.CodeLens(decl.range, {
              title: t('maa.pipeline.codelens.resource-activated'),
              command: ''
            })
          : new vscode.CodeLens(decl.range, {
              title: t('maa.pipeline.codelens.resource-switch'),
              command: commands.PISwitchResource,
              arguments: [decl.name]
            })
      )
    }
    return result
  }
}
