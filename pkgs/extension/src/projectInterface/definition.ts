import * as vscode from 'vscode'

import { PipelineTaskIndexProvider } from '../pipeline/task'
import { ProjectInterfaceIndexerProvider } from './indexer'
import { ProviderBase } from './providerBase'

export class ProjectInterfaceDefinitionProvider
  extends ProviderBase
  implements vscode.DefinitionProvider
{
  constructor() {
    super(selector => {
      return vscode.languages.registerDefinitionProvider(selector, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const info = this.shared(ProjectInterfaceIndexerProvider).queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'option.ref') {
      const optionInfo = this.shared(ProjectInterfaceIndexerProvider).optionDecl.find(
        x => x.option === info.option
      )
      return optionInfo
        ? new vscode.Location(
            this.shared(ProjectInterfaceIndexerProvider).interfaceUri!,
            optionInfo.range
          )
        : null
    } else if (info.type === 'case.ref') {
      const caseInfo = this.shared(ProjectInterfaceIndexerProvider).caseDecl.find(
        x => x.option === info.option && x.case === info.case
      )
      return caseInfo
        ? new vscode.Location(
            this.shared(ProjectInterfaceIndexerProvider).interfaceUri!,
            caseInfo.range
          )
        : null
    }

    return null
  }
}
