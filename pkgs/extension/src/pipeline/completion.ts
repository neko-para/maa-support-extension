import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCompletionProvider
  extends ProviderBase
  implements vscode.CompletionItemProvider
{
  constructor() {
    super(selector => {
      return vscode.languages.registerCompletionItemProvider(selector, this, '"')
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    const layer = this.shared(PipelineTaskIndexProvider).getLayer(document.uri)
    if (!layer) {
      return null
    }

    if (info.type === 'task.ref') {
      const taskList = await this.shared(PipelineTaskIndexProvider).queryTaskList(layer.level + 1)

      return await Promise.all(
        taskList.map(async task => {
          const esc = JSON.stringify(task)
          return {
            label: esc,
            kind: vscode.CompletionItemKind.Reference,
            insertText: esc.substring(0, esc.length - 1),
            range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
            documentation: await this.shared(PipelineTaskIndexProvider).queryTaskDoc(task)
          }
        })
      )
    } else if (info.type === 'image.ref') {
      const imageList = await this.shared(PipelineTaskIndexProvider).queryImageList(layer.level + 1)

      return await Promise.all(
        imageList.map(async path => {
          const esc = JSON.stringify(path)
          return {
            label: esc,
            kind: vscode.CompletionItemKind.File,
            insertText: esc.substring(0, esc.length - 1),
            range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
            documentation: await this.shared(PipelineTaskIndexProvider).queryImageDoc(path)
          }
        })
      )
    }

    return null
  }

  resolveCompletionItem?(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item
  }
}
