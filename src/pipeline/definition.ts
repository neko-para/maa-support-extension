import EventEmitter from 'events'
import * as vscode from 'vscode'

import { sharedInstance } from '../data'
import { InheritDisposable } from '../disposable'
import { commands } from './command'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineDefinitionProvider
  extends InheritDisposable
  implements vscode.DefinitionProvider
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
          this.provider = vscode.languages.registerDefinitionProvider(selector, this)
        }
      }
    )
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const info = await sharedInstance(this.context, PipelineTaskIndexProvider).queryLocation(
      document.uri,
      position
    )

    if (!info) {
      return null
    }

    if (info.type === 'task.ref') {
      const targetInfo = sharedInstance(this.context, PipelineTaskIndexProvider).taskIndex[
        info.target
      ]
      if (targetInfo) {
        return new vscode.Location(targetInfo.uri, targetInfo.taskProp)
      }
    } else if (info.type === 'image.ref') {
      try {
        await vscode.workspace.fs.stat(info.target)
        return new vscode.Location(info.target, new vscode.Position(0, 0))
      } catch (_) {
        vscode.window.showErrorMessage(
          `${sharedInstance(this.context, PipelineRootStatusProvider).relativePath(info.target)} 不存在`
        )
      }
    }

    return null
  }
}
