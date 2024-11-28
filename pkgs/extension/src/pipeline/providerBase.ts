import * as vscode from 'vscode'

import { Service } from '../data'
import { PipelineProjectInterfaceProvider } from './pi'

export class ProviderBase<T extends vscode.Disposable = vscode.Disposable> extends Service {
  provider: T | null

  constructor(setupProvider: (selector: vscode.DocumentFilter[]) => T) {
    super()

    this.provider = null

    this.shared(PipelineProjectInterfaceProvider).event.on(
      'activateResourceChanged',
      async resource => {
        if (this.provider) {
          this.provider.dispose()
          this.provider = null
        }
        this.provider = setupProvider(
          resource.map(path => ({
            pattern: new vscode.RelativePattern(path, 'pipeline/**/*.json')
          }))
        )
      }
    )
  }
}
