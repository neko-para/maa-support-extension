import * as vscode from 'vscode'

import { ProviderBase } from './providerBase'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCompletionProvider
  extends ProviderBase
  implements vscode.CompletionItemProvider
{
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
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

    if (info.type === 'task.ref') {
      const taskList = Object.keys(this.shared(PipelineTaskIndexProvider).taskIndex)
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
      const pt = this.shared(PipelineRootStatusProvider).imagePattern()
      if (!pt) {
        return null
      }
      return (await vscode.workspace.findFiles(pt)).map(uri => {
        const path = this.shared(PipelineRootStatusProvider)
          .relativePathToRoot(uri, 'image')
          .replace(/^[\\/]/, '')
        const esc = JSON.stringify(path)
        return {
          label: esc,
          kind: vscode.CompletionItemKind.File,
          insertText: esc.substring(0, esc.length - 1),
          range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
          documentation: new vscode.MarkdownString(`![](${uri})`)
        }
      })
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
