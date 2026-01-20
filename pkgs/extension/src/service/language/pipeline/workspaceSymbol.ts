import * as path from 'path'
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
      const [decls, refs] = layer.mergeDeclsRefs() // TODO: fix file absolute problem
      for (const decl of decls) {
        if (decl.type !== 'task.decl') {
          continue
        }
        if (decl.task.toLowerCase().indexOf(query) === -1) {
          continue
        }
        const uri = vscode.Uri.file(decl.file)
        const doc = await vscode.workspace.openTextDocument(uri)
        const loc = convertRangeLocation(doc, decl.location)
        result.push(
          new vscode.SymbolInformation(
            decl.task,
            vscode.SymbolKind.Class,
            `${path.basename(decl.file)}:${loc.range.start.line + 1}`,
            loc
          )
        )
      }
      layer = layer.parent
    }

    return result
  }
}
