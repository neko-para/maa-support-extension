import * as vscode from 'vscode'

import { commands } from '../command'
import { ProviderBase } from './providerBase'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCodeLensProvider extends ProviderBase implements vscode.CodeLensProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
      return vscode.languages.registerCodeLensProvider(selector, this)
    })

    this.defer = vscode.commands.registerCommand(commands.LaunchTask, async (task?: string) => {
      if (!task) {
        // select task
        return
      }
      console.log(task)
    })
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[] | null> {
    return null
    /*
    const result: vscode.CodeLens[] = []
    for (const taskName of this.shared(PipelineTaskIndexProvider).fileIndex[document.uri.fsPath]) {
      result.push(
        new vscode.CodeLens(this.shared(PipelineTaskIndexProvider).taskIndex[taskName].taskProp, {
          title: vscode.l10n.t('maa.pipeline.codelens.launch', taskName),
          command: commands.LaunchTask,
          arguments: [taskName]
        })
      )
    }
    return result
    */
  }

  resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens
  }
}
