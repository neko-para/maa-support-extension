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
      const taskInfo = await this.shared(PipelineTaskIndexProvider).queryTask(info.target)
      return taskInfo.map(x => new vscode.Location(x.info.uri, x.info.taskProp))
    } else if (info.type === 'image.ref') {
      const imageInfo = await this.shared(PipelineTaskIndexProvider).queryImage(info.target)
      return imageInfo.map(x => new vscode.Location(x.info.uri, new vscode.Position(0, 0)))
    }

    return null
  }
}
