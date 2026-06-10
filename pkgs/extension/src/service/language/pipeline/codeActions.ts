import * as vscode from 'vscode'

import { FileViewUtils, Snapshot, findDeclRef } from '@nekosu/maa-pipeline-manager-vnext'

import { PipelineLanguageProvider } from './base'

function isSelection(range: vscode.Range | vscode.Selection): range is vscode.Selection {
  return 'anchor' in range
}

export class PipelineCodeActionsProvider
  extends PipelineLanguageProvider
  implements vscode.CodeActionProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerCodeActionsProvider(sel, this)
    })

    // TODO(Phase8): LocaleExtract command — 需要 AST 位置 + 文件写入 (addPair)
    // this.defer = vscode.commands.registerCommand(commands.LocaleExtract, async (...) => { ... })
  }

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    if (!isSelection(range)) {
      return []
    }

    const snapshot = await this.flush()
    if (!snapshot) {
      return []
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return []
    }
    const { file } = located

    const offset = document.offsetAt(range.active)
    const decls = FileViewUtils.allDecls(file)
    const refs = FileViewUtils.allRefs(file)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    if (decl) {
      if (decl.type === 'task.decl') {
        // TODO(Phase8): toggleMode — vNext 需补充 v1↔v2 格式切换
        return []
      }
    } else if (ref) {
      // TODO(Phase8): LocaleExtract — 需要 AST 位置 + 文件写入 (addPair)
      // if (ref.type === 'task.can_locale') {
      //   const action = new vscode.CodeAction(...)
      //   action.command = { ... commands.LocaleExtract ... }
      //   return [action]
      // }
    }
    return []
  }
}
