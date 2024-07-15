import * as vscode from 'vscode'

import { commands } from '../command'
import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineRenameProvider extends ProviderBase implements vscode.RenameProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
      return vscode.languages.registerRenameProvider(selector, this)
    })
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken
  ): Promise<vscode.WorkspaceEdit> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      throw vscode.l10n.t('maa.pipeline.error.rename-not-allowed')
    }

    if (newName in this.shared(PipelineTaskIndexProvider).taskIndex) {
      throw vscode.l10n.t('maa.pipeline.error.rename-already-exists')
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const edit = new vscode.WorkspaceEdit()

      const targetInfo = this.shared(PipelineTaskIndexProvider).taskIndex[info.target]
      edit.replace(targetInfo.uri, targetInfo.taskProp, JSON.stringify(newName))

      for (const taskInfo of Object.values(this.shared(PipelineTaskIndexProvider).taskIndex)) {
        for (const refInfo of taskInfo.taskRef) {
          if (refInfo.task === info.target) {
            edit.replace(taskInfo.uri, refInfo.range, JSON.stringify(newName))
          }
        }
      }

      return edit
    }

    throw vscode.l10n.t('maa.pipeline.error.rename-not-allowed')
  }

  async prepareRename?(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Range | { range: vscode.Range; placeholder: string }> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      throw vscode.l10n.t('maa.pipeline.error.rename-not-allowed')
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      return {
        range: info.range,
        placeholder: JSON.parse(document.getText(info.range))
      }
    }

    throw vscode.l10n.t('maa.pipeline.error.rename-not-allowed')
  }
}
