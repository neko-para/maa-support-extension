import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { PipelineLanguageProvider } from './base'

export class PipelineCompletionProvider
  extends PipelineLanguageProvider
  implements vscode.CompletionItemProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerCompletionItemProvider(sel, this, '"')
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
    const [info, layer] = await taskIndexService.queryLocation(document.uri, position)

    if (!info || !layer) {
      return null
    }

    if (info.type === 'task.ref') {
      const taskList = await taskIndexService.queryTaskList(layer.level + 1)

      return await Promise.all(
        taskList.map(async task => {
          const esc = JSON.stringify(task)
          return {
            label: esc,
            kind: vscode.CompletionItemKind.Reference,
            insertText: esc.substring(0, esc.length - 1),
            range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
            documentation: await taskIndexService.queryTaskDoc(task, layer.level + 1, position)
          }
        })
      )
    } else if (info.type === 'image.ref') {
      const imageList = await taskIndexService.queryImageList(layer.level + 1)

      return await Promise.all(
        imageList.map(async path => {
          const esc = JSON.stringify(path)
          return {
            label: esc,
            kind: vscode.CompletionItemKind.File,
            insertText: esc.substring(0, esc.length - 1),
            range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
            documentation: await taskIndexService.queryImageDoc(path)
          }
        })
      )
    }

    return null
  }
}
