import * as vscode from 'vscode'

import { AbsolutePath } from '@mse/pipeline-manager'
import { t } from '@mse/utils'

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
  didChangeCodeLenses: vscode.EventEmitter<void>
  get onDidChangeCodeLenses() {
    return this.didChangeCodeLenses.event
  }

  fireChangeCodeLenses: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeLensProvider(sel, this)
    })

    this.didChangeCodeLenses = new vscode.EventEmitter()

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
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[] | null> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo

    const result: vscode.CodeLens[] = []
    for (const [name, taskInfos] of Object.entries(layer.tasks)) {
      for (const taskInfo of taskInfos) {
        if (taskInfo.file !== file) {
          continue
        }

        if (isMaaAssistantArknights) {
          // TODO
        } else {
          const range = convertRange(document, taskInfo.prop)
          result.push(
            new vscode.CodeLens(range, {
              title: t('maa.pipeline.codelens.launch'),
              command: commands.LaunchTask,
              arguments: [name]
            })
          )
        }
      }
    }
    return result

    /*

    for (const [taskName, taskInfos] of Object.entries(layer.index)) {
      for (const taskInfo of taskInfos) {
        if (taskInfo.uri.fsPath !== document.uri.fsPath) {
          continue
        }
        if (!isMaaAssistantArknights) {
          result.push(
            new vscode.CodeLens(taskInfo.taskProp, {
              title: t('maa.pipeline.codelens.launch'),
              command: commands.LaunchTask,
              arguments: [taskName]
            })
          )
        } else {
          result.push(
            new vscode.CodeLens(taskInfo.taskProp, {
              title: t('maa.pipeline.codelens.eval-task'),
              command: commands.EvalTask,
              arguments: [taskName]
            })
          )
        }
      }
    }
    return result
    */
  }
}
