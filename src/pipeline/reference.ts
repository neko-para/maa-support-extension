import EventEmitter from 'events'
import * as vscode from 'vscode'

import { Service, sharedInstance } from '../data'
import { ProviderBase } from './providerBase'
import { PipelineRootStatusProvider } from './root'
import { PipelineTaskIndexProvider } from './task'

export class PipelineReferenceProvider extends ProviderBase implements vscode.ReferenceProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, selector => {
      return vscode.languages.registerReferenceProvider(selector, this)
    })
  }

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    const info = await this.shared(PipelineTaskIndexProvider).queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const result: vscode.Location[] = []
      for (const taskInfo of Object.values(this.shared(PipelineTaskIndexProvider).taskIndex)) {
        for (const refInfo of taskInfo.taskRef) {
          if (refInfo.task === info.target) {
            result.push(new vscode.Location(taskInfo.uri, refInfo.range))
          }
        }
      }
      return result
    }

    return null
  }
}
