import path from 'path'
import * as vscode from 'vscode'

import { InterfaceBundle, InterfaceRefInfo, findDeclRef, joinPath } from '@mse/pipeline-manager'
import { Interface } from '@mse/types'
import { t } from '@mse/utils'

import { interfaceService } from '../..'
import { commands } from '../../../command'
import { debounce } from '../../utils/debounce'
import { convertRange } from '../utils'
import { InterfaceLanguageProvider } from './base'

export type InsertPolicy = [
  type: 'before' | 'after',
  ref: InterfaceRefInfo & { type: 'interface.locale' }
]

function isSelection(range: vscode.Range | vscode.Selection): range is vscode.Selection {
  return 'anchor' in range
}

export class InterfaceCodeActionsProvider
  extends InterfaceLanguageProvider
  implements vscode.CodeActionProvider
{
  didChangeCodeActions = new vscode.EventEmitter<void>()
  get onDidChangeCodeActions() {
    return this.didChangeCodeActions.event
  }

  fireChangeCodeActions: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerCodeActionsProvider(sel, this)
    })

    this.defer = this.didChangeCodeActions

    this.fireChangeCodeActions = debounce(() => {
      this.didChangeCodeActions.fire()
    }, 50)

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.fireChangeCodeActions()
    })

    this.defer = vscode.commands.registerCommand(
      commands.LocaleExtract,
      async (
        intBundle: InterfaceBundle<Partial<Interface>>,
        document: vscode.TextDocument,
        ref: InterfaceRefInfo & { type: 'interface.can_locale' }
      ) => {
        const currentRefs = intBundle.sortLocaleRef()
        const insertAt = intBundle.findEmplaceLocation(currentRefs, ref.file, ref.location.offset)

        const insertPolicy: InsertPolicy[] = []

        const prevRefs = currentRefs.slice(0, insertAt)
        const afterRefs = currentRefs.slice(insertAt)
        prevRefs.reverse()

        while (prevRefs.length > 0 && prevRefs[0].file === ref.file) {
          insertPolicy.push(['after', prevRefs.shift()!])
        }
        while (afterRefs.length > 0 && afterRefs[0].file === ref.file) {
          insertPolicy.push(['before', afterRefs.shift()!])
        }

        insertPolicy.push(...prevRefs.map(ref => ['after', ref] as InsertPolicy))
        insertPolicy.push(...afterRefs.map(ref => ['before', ref] as InsertPolicy))

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

        const edit = new vscode.WorkspaceEdit()
        edit.replace(
          document.uri,
          convertRange(document, ref.location),
          JSON.stringify('$' + localeKey)
        )

        const mainContent = JSON.stringify(localeKey) + ': ' + JSON.stringify(ref.text) + ','
        for (const [idx, [localeName, file]] of intBundle.langFiles.entries()) {
          const uri = vscode.Uri.file(joinPath(intBundle.root, file))
          const doc = await vscode.workspace.openTextDocument(uri)

          const obj = intBundle.langs[idx].object ?? {}
          if (Object.keys(obj).length === 0) {
            edit.createFile(uri, {
              overwrite: true,
              contents: Buffer.from(
                `{
    ${mainContent}
}
`,
                'utf8'
              )
            })
            continue
          }

          let found = false
          for (const [behavior, anchor] of insertPolicy) {
            const info = intBundle.langIndex[anchor.target].find(info => info.locale === localeName)
            if (!info) {
              continue
            }

            const propRange = convertRange(doc, info.prop)
            const propLeft = doc.getText(
              new vscode.Range(new vscode.Position(propRange.start.line, 0), propRange.start)
            )
            let indent: string
            if (/^[ \t]*$/.test(propLeft)) {
              indent = propLeft
            } else {
              indent = ' '.repeat(doc.lineAt(propRange.start.line).firstNonWhitespaceCharacterIndex) // 用这个凑合着猜一个indent
            }

            const valueRange = convertRange(doc, info.location)
            const line = doc.lineAt(valueRange.end.line)
            const valueRight = doc.getText(new vscode.Range(valueRange.end, line.range.end))

            let insertContent: string
            let insertPos: vscode.Position
            if (behavior === 'before') {
              insertContent = `${mainContent}\n${indent}`
              insertPos = propRange.start
            } else {
              insertContent = `\n${indent}${mainContent}`
              if (valueRight === '') {
                insertContent = ',' + insertContent
                insertPos = valueRange.end
              } else {
                insertPos = line.range.end
              }
            }

            edit.insert(uri, insertPos, insertContent)

            found = true
            break
          }
          if (!found) {
            vscode.window.showWarningMessage(
              `无法为文件 ${path.basename(file)} 找到合适的插入位置, 请手动补充`
            )
          }
        }

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
    if (!intBundle || intBundle.langs.length === 0) {
      return []
    }

    const offset = document.offsetAt(range.active)
    const allRefs = this.findRefs(intBundle.info, 'interface.can_locale').filter(
      ref => ref.file === document.uri.fsPath
    )
    const ref = findDeclRef(allRefs, offset)

    if (!ref) {
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
