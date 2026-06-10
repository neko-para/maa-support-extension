import * as vscode from 'vscode'

import { t } from '@nekosu/maa-locale'
import { Snapshot, extractTaskRef } from '@nekosu/maa-pipeline-manager-vnext'

import { interfaceService } from '../..'
import { commands } from '../../../command'
import { isMaaAssistantArknights } from '../../../utils/fs'
import { debounce } from '../../utils/debounce'
import { convertRange } from '../utils'
import { PipelineLanguageProvider } from './base'

export class PipelineCodeLensProvider
  extends PipelineLanguageProvider
  implements vscode.CodeLensProvider
{
  didChangeCodeLenses = new vscode.EventEmitter<void>()
  get onDidChangeCodeLenses() {
    return this.didChangeCodeLenses.event
  }

  fireChangeCodeLenses: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })

    this.defer = this.didChangeCodeLenses

    this.fireChangeCodeLenses = debounce(() => {
      this.didChangeCodeLenses.fire()
    })

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.fireChangeCodeLenses()
    })
    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.fireChangeCodeLenses()
    })
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[] | null> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return null
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return null
    }
    const { file } = located

    if (file.isDefault) {
      return []
    }

    const allRefsArr = Snapshot.allRefs(snapshot)
    const taskRefCounts = new Map<string, number>()
    for (const r of allRefsArr) {
      const refTarget = extractTaskRef(r)
      if (refTarget) {
        taskRefCounts.set(refTarget, (taskRefCounts.get(refTarget) ?? 0) + 1)
      }
    }

    const result: vscode.CodeLens[] = []
    for (const [name, taskInfos] of file.tasks) {
      for (const info of taskInfos) {
        const taskDecl = info.decls.find(d => d.type === 'task.decl')
        if (!taskDecl || taskDecl.file !== file.path) {
          continue
        }

        if (isMaaAssistantArknights) {
          result.push(
            new vscode.CodeLens(convertRange(document, taskDecl.location), {
              title: t('maa.pipeline.codelens.eval-task'),
              command: commands.EvalTask,
              arguments: [name]
            })
          )
        } else {
          const range = convertRange(document, taskDecl.location)
          result.push(
            new vscode.CodeLens(range, {
              title: t('maa.pipeline.codelens.launch'),
              command: commands.LaunchTask,
              arguments: [name]
            })
          )
          result.push(
            new vscode.CodeLens(range, {
              title: t('maa.pipeline.codelens.refs', `${taskRefCounts.get(name) ?? 0}`),
              command: commands.FindTaskRef,
              arguments: [name, document.uri, document.positionAt(taskDecl.location.offset)]
            })
          )
        }
      }
    }
    return result
  }
}
