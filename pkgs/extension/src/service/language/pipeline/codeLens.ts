import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { taskIndexService } from '../..'
import { commands } from '../../../command'
import { PipelineLanguageProvider } from './base'

export class PipelineCodeLensProvider
  extends PipelineLanguageProvider
  implements vscode.CodeLensProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[] | null> {
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
