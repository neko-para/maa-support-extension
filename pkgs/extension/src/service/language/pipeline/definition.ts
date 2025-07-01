import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { PipelineLanguageProvider } from './base'

export class PipelineDefinitionProvider
  extends PipelineLanguageProvider
  implements vscode.DefinitionProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerDefinitionProvider(sel, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    await taskIndexService.flushDirty()

    const [info, layer] = await taskIndexService.queryLocation(document.uri, position)

    if (!info || !layer) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const taskInfo = await taskIndexService.queryTask(
        info.target,
        layer.level + 1,
        undefined // position 这里不传入position, 使得查找定义能够找到所有重复版本
      )
      return taskInfo.map(x => new vscode.Location(x.info.uri, x.info.taskProp))
    }

    return null
  }
}
