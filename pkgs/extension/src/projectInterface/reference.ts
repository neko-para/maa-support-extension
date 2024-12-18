import * as vscode from 'vscode'

import { ProjectInterfaceIndexerProvider } from './indexer'
import { ProviderBase } from './providerBase'

export class ProjectInterfaceReferenceProvider
  extends ProviderBase
  implements vscode.ReferenceProvider
{
  constructor() {
    super(selector => {
      return vscode.languages.registerReferenceProvider(selector, this)
    })
  }

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    const info = await this.shared(ProjectInterfaceIndexerProvider).queryLocation(
      document.uri,
      position
    )

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      const result: vscode.Location[] = []
      const decl = this.shared(ProjectInterfaceIndexerProvider).optionDecl.find(
        x => x.option === info.option
      )
      for (const ref of this.shared(ProjectInterfaceIndexerProvider).refs) {
        if (
          ref.type === 'option.ref' &&
          ref.option === info.option &&
          (!decl || !ref.range.isEqual(decl.range))
        ) {
          result.push(
            new vscode.Location(
              this.shared(ProjectInterfaceIndexerProvider).interfaceUri!,
              ref.range
            )
          )
        }
      }
      return result
    }

    return null
  }
}
