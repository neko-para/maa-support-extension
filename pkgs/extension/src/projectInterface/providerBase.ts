import * as vscode from 'vscode'

import { Service } from '../data'
import { PipelineRootStatusProvider } from '../pipeline/root'

export class ProviderBase<T extends vscode.Disposable = vscode.Disposable> extends Service {
  provider: T | null

  constructor(setupProvider: (selector: vscode.DocumentFilter) => T) {
    super()

    this.provider = null

    this.shared(PipelineRootStatusProvider).event.on('activateRootChanged', async () => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = null
      }
      const root = this.shared(PipelineRootStatusProvider).activateResource
      if (root) {
        this.provider = setupProvider({
          pattern: new vscode.RelativePattern(root.dirUri, 'interface.json')
        }) // stupid, but just works
      }
    })
  }
}
