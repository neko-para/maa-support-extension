import * as vscode from 'vscode'

import { Service } from '../data'
import { PipelineRootStatusProvider } from './root'

export class ProviderBase extends Service {
  provider: vscode.Disposable | null

  constructor(
    context: vscode.ExtensionContext,
    setupProvider: (selector: vscode.DocumentFilter[]) => vscode.Disposable
  ) {
    super(context)

    this.provider = null

    this.shared(PipelineRootStatusProvider).event.on('activateSelectorChanged', async selector => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = null
      }
      if (selector) {
        this.provider = setupProvider(selector)
      }
    })
  }
}
