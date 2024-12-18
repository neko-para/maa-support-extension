import { watch } from 'reactive-vscode'
import * as vscode from 'vscode'

import { Service } from '../data'
import { ProjectInterfaceJsonProvider } from '../projectInterface/json'

export class ProviderBase<T extends vscode.Disposable = vscode.Disposable> extends Service {
  provider: T | null

  constructor(setupProvider: (selector: vscode.DocumentFilter[]) => T) {
    super()

    this.provider = null

    watch(
      () => {
        return this.shared(ProjectInterfaceJsonProvider).resourceKey.value
      },
      () => {
        if (this.provider) {
          this.provider.dispose()
          this.provider = null
        }
        this.provider = setupProvider(
          this.shared(ProjectInterfaceJsonProvider).resourcePaths.value.map(path => ({
            pattern: new vscode.RelativePattern(path, 'pipeline/**/*.json')
          }))
        )
      }
    )
  }
}
