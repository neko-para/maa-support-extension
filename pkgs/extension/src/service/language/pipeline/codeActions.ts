import * as vscode from 'vscode'

import { t } from '@mse/locale'
import {
  AbsolutePath,
  InterfaceBundle,
  InterfaceRefInfo,
  TaskRefInfo,
  findDeclRef
} from '@mse/pipeline-manager'
import { Interface } from '@mse/types'

import { commands } from '../../../command'
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
          title: t('maa.pipeline.codeaction.input-key'),
          ignoreFocusOut: true,
          validateInput: value => {
            if (knownKeys.includes(value)) {
              return t('maa.pipeline.codeaction.key-exists')
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
    const decls = layer.mergedDecls.filter(decl => decl.file === file)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    if (decl) {
      if (decl.type === 'task.decl') {
        const info = layer.tasks[decl.task].find(info => info.file === file)
        if (!info) {
          return []
        }

        const doc = await vscode.workspace.openTextDocument(info.file)
        const propPos = doc.positionAt(info.prop.offset)
        const indent = doc.getText(new vscode.Range(new vscode.Position(propPos.line, 0), propPos))

        const replaceRange = new vscode.Range(
          propPos,
          doc.positionAt(info.data.offset + info.data.length)
        )

        const editToV1 = new vscode.WorkspaceEdit()
        editToV1.replace(doc.uri, replaceRange, layer.toggleMode(1, info, indent))
        const actionToV1 = new vscode.CodeAction(
          t('maa.pipeline.codeaction.switch-to-v1'),
          vscode.CodeActionKind.RefactorRewrite
        )
        actionToV1.edit = editToV1

        const editToV2 = new vscode.WorkspaceEdit()
        editToV2.replace(doc.uri, replaceRange, layer.toggleMode(2, info, indent))
        const actionToV2 = new vscode.CodeAction(
          t('maa.pipeline.codeaction.switch-to-v2'),
          vscode.CodeActionKind.RefactorRewrite
        )
        actionToV2.edit = editToV2

        return [actionToV1, actionToV2]
      }
    } else if (ref) {
      if (ref.type === 'task.can_locale') {
        const action = new vscode.CodeAction(
          t('maa.pipeline.codeaction.extract-locale'),
          vscode.CodeActionKind.RefactorExtract
        )
        action.command = {
          title: t('maa.pipeline.codeaction.extract-locale'),
          command: commands.LocaleExtract,
          arguments: [intBundle, document, ref]
        }

        return [action]
      }
    }
    return []
  }
}
