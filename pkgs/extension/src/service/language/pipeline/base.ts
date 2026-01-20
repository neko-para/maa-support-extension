import path from 'path'
import * as vscode from 'vscode'

import { TaskName } from '@mse/pipeline-manager'
import { LayerInfo } from '@mse/pipeline-manager/src/layer/layer'

import { interfaceService, rootService } from '../..'
import { pipelineSuffix } from '../../../utils/fs'
import { BaseService } from '../../context'

export class PipelineLanguageProvider extends BaseService {
  provider?: vscode.Disposable

  constructor(setup: (selector: vscode.DocumentFilter[]) => vscode.Disposable) {
    super()

    this.defer = {
      dispose: () => {
        this.provider?.dispose()
      }
    }

    this.defer = interfaceService.onResourceChanged(() => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const filters: vscode.DocumentFilter[] = interfaceService.resourcePaths.map(path => ({
        scheme: 'file',
        pattern: new vscode.RelativePattern(
          vscode.Uri.joinPath(path, pipelineSuffix),
          '**/*.{json,jsonc}'
        )
      }))
      const root = rootService.activeResource
      if (root) {
        filters.push({
          pattern: new vscode.RelativePattern(root.dirUri, path.basename(root.interfaceUri.fsPath))
        })
      }
      this.provider = setup(filters)
    })
  }

  shouldFilter(doc: vscode.TextDocument) {
    return interfaceService.shouldFilter(doc.uri)
  }

  async flush() {
    await interfaceService.interfaceBundle?.flush(true)
    return interfaceService.interfaceBundle ?? null
  }

  async flushIndex() {
    return (await this.flush())?.info ?? null
  }

  getTaskBrief(layer: LayerInfo, task: string) {
    const info = layer.getTaskBriefInfo(task as TaskName)
    return `Reco: ${info.reco ?? 'DirectHit'}\n\nAct: ${info.act ?? 'DoNothing'}`
  }

  async getTaskHover(layer: LayerInfo, task: string) {
    const taskInfos = layer.getTask(task as TaskName)
    const content: string[] = []
    for (const { layer, infos } of taskInfos) {
      for (const info of infos) {
        const doc = await vscode.workspace.openTextDocument(info.file)
        const begin = doc.positionAt(info.prop.offset)
        const end = doc.positionAt(info.data.offset + info.data.length)
        const range = new vscode.Range(
          new vscode.Position(begin.line, 0),
          new vscode.Position(end.line + 1, 0)
        )
        content.push(`${layer.root}

\`\`\`json
${doc.getText(range)}
\`\`\`
`)
      }
    }
    return content.join('\n')
  }
}
