import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { PipelineLanguageProvider } from './base'

export class PipelineWorkspaceSymbolProvider
  extends PipelineLanguageProvider
  implements vscode.WorkspaceSymbolProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerWorkspaceSymbolProvider(this)
    })
  }

  async provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken
  ): Promise<vscode.SymbolInformation[]> {
    return taskIndexService.queryWorkspaceSymbol(query)
  }
}
