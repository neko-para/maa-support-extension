import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineDefinitionProvider extends ProviderBase implements vscode.DefinitionProvider {
  constructor() {
    super(selector => {
      return vscode.languages.registerDefinitionProvider(selector, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const [info, layer] = await this.shared(PipelineTaskIndexProvider).queryLocation(
      document.uri,
      position
    )

    if (!info || !layer) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const taskInfo = await this.shared(PipelineTaskIndexProvider).queryTask(
        info.target,
        layer.level + 1,
        undefined // position 这里不传入position, 使得查找定义能够找到所有重复版本
      )
      return taskInfo.map(x => new vscode.Location(x.info.uri, x.info.taskProp))
    }

    return null
  }
}
