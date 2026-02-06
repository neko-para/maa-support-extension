import * as vscode from 'vscode'

import { t } from '@mse/locale'
import { AbsolutePath } from '@mse/pipeline-manager'

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
    const [layer, file, isDefault] = layerInfo

    if (isDefault) {
      return []
    }

    const result: vscode.CodeLens[] = []
    for (const [name, taskInfos] of Object.entries(layer.tasks)) {
      for (const taskInfo of taskInfos) {
        if (taskInfo.file !== file) {
          continue
        }

        if (isMaaAssistantArknights) {
          result.push(
            new vscode.CodeLens(convertRange(document, taskInfo.prop), {
              title: t('maa.pipeline.codelens.eval-task'),
              command: commands.EvalTask,
              arguments: [name]
            })
          )
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
  }
}
