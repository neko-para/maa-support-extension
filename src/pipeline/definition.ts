import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineDefinitionProvider extends ProviderBase implements vscode.DefinitionProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
      return vscode.languages.registerDefinitionProvider(selector, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const targetInfo = this.shared(PipelineTaskIndexProvider).taskIndex[info.target]
      if (targetInfo) {
        return new vscode.Location(targetInfo.uri, targetInfo.taskProp)
      }
    } else if (info.type === 'image.ref') {
      try {
        await vscode.workspace.fs.stat(info.target)
        return new vscode.Location(info.target, new vscode.Position(0, 0))
      } catch (_) {
        vscode.window.showErrorMessage(
          vscode.l10n.t(
            'maa.pipeline.error.not-exists',
            this.shared(PipelineRootStatusProvider).relativePath(info.target)
          )
        )
      }
    }

    return null
  }
}
