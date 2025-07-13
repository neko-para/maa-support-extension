import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { isMaaAssistantArknights } from '../../../utils/fs'
import { PipelineLanguageProvider } from './base'

export class PipelineReferenceProvider
  extends PipelineLanguageProvider
  implements vscode.ReferenceProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerReferenceProvider(sel, this)
    })
  }

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    await taskIndexService.flushDirty()

    const [info, _] = await taskIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const result: vscode.Location[] = []
      for (const layer of taskIndexService.layers) {
        for (const [task, taskInfos] of Object.entries(layer.index)) {
          for (const taskInfo of taskInfos) {
            for (const refInfo of taskInfo.taskRef) {
              if (refInfo.task === info.target) {
                result.push(new vscode.Location(taskInfo.uri, refInfo.range))
              }
              if (isMaaAssistantArknights) {
                if (refInfo.task.endsWith('@' + info.target)) {
                  result.push(new vscode.Location(taskInfo.uri, refInfo.range))
                }
              }
            }
            if (isMaaAssistantArknights) {
              if (task.endsWith('@' + info.target)) {
                result.push(new vscode.Location(taskInfo.uri, taskInfo.taskProp))
              }
            }
          }
        }
      }
      return result
    }

    return null
  }
}
