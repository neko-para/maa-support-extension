import path from 'path'
import * as vscode from 'vscode'

import {
  AbsolutePath,
  InterfaceBundle,
  InterfaceRefInfo,
  TaskRefInfo,
  findDeclRef,
  joinPath
} from '@mse/pipeline-manager'
import { Interface } from '@mse/types'
import { t } from '@mse/utils'

import { interfaceService } from '../..'
import { commands } from '../../../command'
import { debounce } from '../../utils/debounce'
import { convertRange } from '../utils'
import { PipelineLanguageProvider } from './base'

export type InsertPolicy = [
  type: 'before' | 'after',
  ref: InterfaceRefInfo & { type: 'interface.locale' }
]

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

    this.defer = vscode.commands.registerCommand(
      commands.LocaleExtract,
      async (
        intBundle: InterfaceBundle<Partial<Interface>>,
        document: vscode.TextDocument,
        ref: TaskRefInfo & { type: 'task.can_locale' }
      ) => {
        const knownKeys = intBundle.langBundle.allKeys()

        const localeKey = await vscode.window.showInputBox({
          title: '输入国际化Key',
          ignoreFocusOut: true,
          validateInput: value => {
            if (knownKeys.includes(value)) {
              return '已存在'
            }
            return undefined
          }
        })

        if (!localeKey) {
          return
        }

        const editActions = intBundle.langBundle.addPair(localeKey, ref.target)
        const edit = new vscode.WorkspaceEdit()

        edit.replace(
          document.uri,
          convertRange(document, ref.location),
          JSON.stringify('$' + localeKey)
        )

        for (const action of editActions) {
          if (action.type === 'replace') {
            edit.createFile(vscode.Uri.file(action.file), {
              contents: Buffer.from(action.content),
              overwrite: true
            })
          } else if (action.type === 'insert') {
            const uri = vscode.Uri.file(action.file)
            const doc = await vscode.workspace.openTextDocument(uri)
            const pos = doc.positionAt(action.offset)
            edit.replace(uri, new vscode.Range(pos, pos), action.content)
          }
        }

        // if (!found) {
        //   vscode.window.showWarningMessage(
        //     `无法为文件 ${path.basename(file)} 找到合适的插入位置, 请手动补充`
        //   )
        // }

        await vscode.workspace.applyEdit(edit, {
          isRefactoring: true
        })
      }
    )
  }

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    if (!isSelection(range)) {
      return []
    }

    const intBundle = await this.flush()
    if (!intBundle) {
      return []
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return []
    }
    const [layer, file] = layerInfo

    const offset = document.offsetAt(range.active)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)
    const ref = findDeclRef(refs, offset)

    if (!ref) {
      return []
    }

    if (ref.type !== 'task.can_locale') {
      return []
    }

    const action = new vscode.CodeAction('提取文案', vscode.CodeActionKind.RefactorExtract)
    action.command = {
      title: '提取文案',
      command: commands.LocaleExtract,
      arguments: [intBundle, document, ref]
    }

    return [action]
  }
}
