import EventEmitter from 'events'
import * as vscode from 'vscode'

import { sharedInstance } from '../data'
import { InheritDisposable } from '../disposable'
import { commands } from './command'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineCompletionProvider
  extends InheritDisposable
  implements vscode.CompletionItemProvider
{
  context: vscode.ExtensionContext
  provider: vscode.Disposable | null

  constructor(context: vscode.ExtensionContext) {
    super()

    this.context = context
    this.provider = null

    sharedInstance(context, PipelineRootStatusProvider).event.on(
      'activateSelectorChanged',
      async selector => {
        if (this.provider) {
          this.provider.dispose()
          this.provider = null
        }
        if (selector) {
          this.provider = vscode.languages.registerCompletionItemProvider(selector, this, '"')
        }
      }
    )
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
    const info = await sharedInstance(this.context, PipelineTaskIndexProvider).queryLocation(
      document.uri,
      position
    )

    if (!info) {
      return null
    }

    if (info.type === 'task.ref') {
      const taskList = Object.keys(
        sharedInstance(this.context, PipelineTaskIndexProvider).taskIndex
      )
      return taskList.map(task => {
        const esc = JSON.stringify(task)
        return {
          label: esc,
          kind: vscode.CompletionItemKind.Reference,
          insertText: esc.substring(0, esc.length - 1),
          range: new vscode.Range(info.range.start, info.range.end.translate(0, -1))
        }
      })
    } else if (info.type === 'image.ref') {
      const pt = sharedInstance(this.context, PipelineRootStatusProvider).imagePattern()
      if (!pt) {
        return null
      }
      return (await vscode.workspace.findFiles(pt)).map(uri => {
        const path = sharedInstance(this.context, PipelineRootStatusProvider)
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
    throw new Error('Method not implemented.')
  }
}
