import { JSONPath, visit } from 'jsonc-parser'
import * as vscode from 'vscode'

import { sharedInstance } from '../data'
import { InheritDisposable } from '../disposable'
import { commands } from './command'
import { PipelineRootStatusProvider } from './root'
import { ResourceRoot } from './utils/fs'

export class PipelineTaskIndexProvider extends InheritDisposable {
  taskIndex: Record<
    string,
    {
      uri: vscode.Uri
      taskProp: [start: number, end: number]
      taskBody: [start: number, end: number]
    }
  >
  fileIndex: Record<string, string[]>

  constructor(context: vscode.ExtensionContext) {
    super()

    sharedInstance(context, PipelineRootStatusProvider).event.on(
      'activateResourceChanged',
      root => {
        this.updateTaskIndex(root)
      }
    )

    this.defer = vscode.commands.registerCommand(commands.GotoTask, async () => {
      const result = await vscode.window.showQuickPick(Object.keys(this.taskIndex))
      if (result) {
        const info = this.taskIndex[result]
        const doc = await vscode.workspace.openTextDocument(info.uri)
        if (doc) {
          const editor = await vscode.window.showTextDocument(doc)
          const start = doc.positionAt(info.taskBody[0])
          const end = doc.positionAt(info.taskBody[1])
          editor.selection = new vscode.Selection(start, end)
        }
      }
    })

    this.defer = vscode.commands.registerCommand(commands.DebugQueryLocation, async () => {
      const editor = vscode.window.activeTextEditor
      if (editor) {
        console.log(
          this.queryLocation(editor.document.uri, editor.document.offsetAt(editor.selection.active))
        )
      }
    })
  }

  loadJson(uri: vscode.Uri, content: string) {
    const path: JSONPath = []
    const fileIndexArr = this.fileIndex[uri.fsPath]
    visit(content, {
      onObjectProperty: (property, offset, length, startLine, startCharacter, pathSupplier) => {
        path[path.length - 1] = property

        if (path.length === 1) {
          this.taskIndex[property] = {
            uri,
            taskProp: [offset, offset + length],
            taskBody: [offset + length, offset + length]
          }
          fileIndexArr.push(property)
        }
      },
      onObjectBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
        if (path.length === 1) {
          const task = path[0]
          this.taskIndex[task].taskBody[0] = offset
        }

        path.push('')
      },
      onObjectEnd: (offset, length, startLine, startCharacter) => {
        path.pop()

        if (path.length === 1) {
          const task = path[0]
          this.taskIndex[task].taskBody[1] = offset + length
        }
      },
      onSeparator: (character, offset, length, startLine, startCharacter) => {
        if (typeof path[path.length - 1] === 'number') {
          ;(path[path.length - 1] as number)++
        }
      },
      onArrayBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
        path.push(0)
      },
      onArrayEnd: (offset, length, startLine, startCharacter) => {
        path.pop()
      }
    })
  }

  async loadTask(dir: vscode.Uri) {
    for (const [name, type] of await vscode.workspace.fs.readDirectory(dir)) {
      const subUri = vscode.Uri.joinPath(dir, name)
      if (type === vscode.FileType.File) {
        if (name.endsWith('.json')) {
          const content = (await vscode.workspace.fs.readFile(subUri)).toString()
          this.fileIndex[subUri.fsPath] = []
          this.loadJson(subUri, content)
        }
      } else if (type === vscode.FileType.Directory) {
        await this.loadTask(subUri)
      }
    }
  }

  async updateTaskIndex(root: ResourceRoot | null) {
    this.taskIndex = {}
    this.fileIndex = {}
    if (root) {
      await this.loadTask(vscode.Uri.joinPath(root[0], 'pipeline'))
    }
  }

  queryLocation(uri: vscode.Uri, pos: number) {
    for (const task of this.fileIndex[uri.fsPath] ?? []) {
      const info = this.taskIndex[task]
      if (info.taskProp[0] <= pos && pos <= info.taskProp[1]) {
        return {
          type: 'task.prop',
          task: task,
          range: info.taskProp
        }
      } else if (info.taskBody[0] <= pos && pos <= info.taskBody[1]) {
        return {
          type: 'task.body',
          task: task,
          range: info.taskBody
        }
      }
    }
    return null
  }
}
