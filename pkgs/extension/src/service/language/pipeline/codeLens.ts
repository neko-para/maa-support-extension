import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { interfaceService, taskIndexService } from '../..'
import { commands } from '../../../command'
import { debounce } from '../../utils/debounce'
import { PipelineLanguageProvider } from './base'

export class PipelineCodeLensProvider
  extends PipelineLanguageProvider
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
    })

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
  ): Promise<vscode.CodeLens[] | null> {
    await taskIndexService.flushDirty()

    const layer = taskIndexService.getLayer(document.uri)

    if (!layer) {
      return []
    }

    const result: vscode.CodeLens[] = []
    for (const [taskName, taskInfos] of Object.entries(layer.index)) {
      for (const taskInfo of taskInfos) {
        if (taskInfo.uri.fsPath !== document.uri.fsPath) {
          continue
        }
        result.push(
          new vscode.CodeLens(taskInfo.taskProp, {
            title: t('maa.pipeline.codelens.launch'),
            command: commands.LaunchTask,
            arguments: [taskName]
          })
        )
      }
    }
    return result
  }
}
