import * as vscode from 'vscode'

import { commands } from '../command'
import { t } from '../locale'
import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCodeLensProvider extends ProviderBase implements vscode.CodeLensProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
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
    for (const [taskName, taskInfo] of Object.entries(layer.taskIndex)) {
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
    return result
  }

  resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens
  }
}
