import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { interfaceService } from '../..'
import { commands } from '../../../command'
import { debounce } from '../../utils/debounce'
import { convertRange } from '../utils'
import { InterfaceLanguageProvider } from './base'

export class InterfaceCodeLensProvider
  extends InterfaceLanguageProvider
  implements vscode.CodeLensProvider
{
  didChangeCodeLenses = new vscode.EventEmitter<void>()
  get onDidChangeCodeLenses() {
    return this.didChangeCodeLenses.event
  }

  fireChangeCodeLenses: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })

    this.defer = this.didChangeCodeLenses

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
    const index = await this.flushIndex()
    if (!index) {
      return []
    }

    const result: vscode.CodeLens[] = []
    for (const decl of index.decls) {
      if (decl.type === 'interface.resource') {
        const activated = decl.name === interfaceService.interfaceConfigJson.resource
        const disabled =
          decl.controller &&
          !decl.controller.includes(interfaceService.interfaceConfigJson.controller?.name ?? '')

        const range = convertRange(document, decl.location)

        result.push(
          activated
            ? new vscode.CodeLens(range, {
                title: t('maa.pipeline.codelens.resource-activated'),
                command: ''
              })
            : disabled
              ? new vscode.CodeLens(range, {
                  title: t('maa.pipeline.codelens.resource-disabled'),
                  command: ''
                })
              : new vscode.CodeLens(range, {
                  title: t('maa.pipeline.codelens.resource-switch'),
                  command: commands.PISwitchResource,
                  arguments: [decl.name]
                })
        )
      } else if (decl.type === 'interface.language') {
        const activated = decl.name === interfaceService.interfaceConfigJson.locale

        const range = convertRange(document, decl.location)

        result.push(
          activated
            ? new vscode.CodeLens(range, {
                title: t('maa.pipeline.codelens.language-activated'),
                command: ''
              })
            : new vscode.CodeLens(range, {
                title: t('maa.pipeline.codelens.language-switch'),
                command: commands.PISwitchLocale,
                arguments: [decl.name]
              })
        )
      }
    }

    return result
  }
}
