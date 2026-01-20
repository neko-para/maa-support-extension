import * as vscode from 'vscode'

import { convertRangeLocation } from '../utils'
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
    const intBundle = await this.flush()
    if (!intBundle) {
      return []
    }

    query = query.toLowerCase()

    const result: vscode.SymbolInformation[] = []

    let layer = intBundle.info?.layer
    while (layer) {
      const decls = layer.mergeDeclsWithFile() // TODO: fix file absolute problem
      for (const [decl, file] of decls) {
        if (decl.type !== 'task.decl') {
          continue
        }
        if (decl.task.toLowerCase().indexOf(query) === -1) {
          continue
        }
        const uri = vscode.Uri.file(file)
        const doc = await vscode.workspace.openTextDocument(uri)
        result.push(
          new vscode.SymbolInformation(
            decl.task,
            vscode.SymbolKind.Class,
            file,
            convertRangeLocation(doc, decl.location)
          )
        )
      }
      layer = layer.parent
    }

    return result

    // return taskIndexService.queryWorkspaceSymbol(query)
  }
}
