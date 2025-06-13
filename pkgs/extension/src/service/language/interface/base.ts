import * as vscode from 'vscode'

import { rootService } from '../..'
import { BaseService } from '../../context'

export class InterfaceLanguageProvider extends BaseService {
  provider?: vscode.Disposable

  constructor(setup: (selector: vscode.DocumentFilter) => vscode.Disposable) {
    super()

    this.defer = {
      dispose: () => {
        this.provider?.dispose()
      }
    }

    this.defer = rootService.onActiveResourceChanged(() => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const root = rootService.activeResource
      if (root) {
        this.provider = setup({
          pattern: new vscode.RelativePattern(root.dirUri, 'interface.json')
        })
      }
    })
  }
}
