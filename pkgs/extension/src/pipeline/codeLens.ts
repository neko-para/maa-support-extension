import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { commands } from '../command'
import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCodeLensProvider extends ProviderBase implements vscode.CodeLensProvider {
  constructor() {
    super(selector => {
      return vscode.languages.registerCodeLensProvider(selector, this)
    })
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[] | null> {
    const layer = this.shared(PipelineTaskIndexProvider).getLayer(document.uri)
    if (!layer) {
      return []
    }

    const result: vscode.CodeLens[] = []
    for (const [taskName, taskInfos] of Object.entries(layer.taskIndex)) {
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

  resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens
  }
}
