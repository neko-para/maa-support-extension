import * as vscode from 'vscode'

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
          pattern: new vscode.RelativePattern(root.dirUri, 'interface.json')
        })
      }
      this.provider = setup(filters)
    })
  }
}
