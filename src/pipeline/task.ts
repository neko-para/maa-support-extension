import * as maa from '@nekosu/maa-node'
import { JSONPath, visit } from 'jsonc-parser'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { ResourceRoot, exists } from '../utils/fs'
import { PipelineRootStatusProvider } from './root'

export type QueryResult =
  | {
      type: 'task.prop'
      task: string
      range: vscode.Range
      target: string // equal to task
    }
  | {
      type: 'task.ref'
      task: string
      range: vscode.Range
      target: string
    }
  | {
      type: 'image.ref'
      task: string
      range: vscode.Range
      target: vscode.Uri
    }
  | {
      type: 'task.body'
      task: string
      range: vscode.Range
    }

export type TaskIndexInfo = {
  uri: vscode.Uri
  taskContent: string
  taskReferContent: string // whole lines
  taskProp: vscode.Range
  taskBody: vscode.Range
  taskRef: {
    task: string
    range: vscode.Range
  }[]
  imageRef: {
    uri: vscode.Uri
    range: vscode.Range
  }[]
}

export class PipelineTaskIndexProvider extends Service {
  taskIndex: Record<string, TaskIndexInfo>
  fileIndex: Record<string, string[]>
  diagnostic: vscode.DiagnosticCollection
  dirtyUri: Map<string, vscode.Uri>
  flushingDirty: boolean
  watcher: vscode.FileSystemWatcher | null

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.taskIndex = {}
    this.fileIndex = {}
    this.diagnostic = vscode.languages.createDiagnosticCollection('maa')
    this.dirtyUri = new Map()
    this.flushingDirty = false
    this.watcher = null

    this.shared(PipelineRootStatusProvider).event.on('activateResourceChanged', root => {
      this.updateTaskIndex(root)
    })

    this.defer = vscode.commands.registerCommand(commands.GotoTask, async () => {
      const result = await vscode.window.showQuickPick(Object.keys(this.taskIndex))
      if (result) {
        const info = this.taskIndex[result]
        const doc = await vscode.workspace.openTextDocument(info.uri)
        if (doc) {
          const editor = await vscode.window.showTextDocument(doc)
          const targetSelection = new vscode.Selection(info.taskBody.start, info.taskBody.end)
          editor.selection = targetSelection
          editor.revealRange(targetSelection)
        }
      }
    })

    this.defer = vscode.commands.registerCommand(commands.DebugQueryLocation, async () => {
      const editor = vscode.window.activeTextEditor
      if (editor) {
        console.log(this.queryLocation(editor.document.uri, editor.selection.active))
      }
    })

    vscode.workspace.onDidChangeTextDocument(event => {
      this.dirtyUri.set(event.document.uri.fsPath, event.document.uri)
    })
  }

  async loadJson(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri)
    if (!doc) {
      return
    }
    const content = doc.getText()
    const path: JSONPath = []
    this.fileIndex[uri.fsPath] = []
    const fileIndexArr = this.fileIndex[uri.fsPath]
    visit(content, {
      onObjectProperty: (property, offset, length, startLine, startCharacter, pathSupplier) => {
        path[path.length - 1] = property
        if (path.length === 1) {
          if (property in this.taskIndex) {
            for (let i = 1; ; i++) {
              const newProp = `${property}@VSCEXT_CONFLICT,${i}`
              if (!(newProp in this.taskIndex)) {
                property = newProp
                break
              }
            }
          }
          this.taskIndex[property] = {
            uri,
            taskContent: '',
            taskReferContent: '',
            taskProp: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
            taskBody: new vscode.Range(0, 0, 0, 0),
            taskRef: [],
            imageRef: []
          }
          fileIndexArr.push(property)
        }
      },
      onObjectBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
        if (path.length === 1) {
          const pos = doc.positionAt(offset)
          this.taskIndex[path[0]].taskBody = new vscode.Range(pos, pos)
        }

        path.push('')
      },
      onObjectEnd: (offset, length, startLine, startCharacter) => {
        path.pop()

        if (path.length === 1) {
          const taskInfo = this.taskIndex[path[0]]
          const pos = doc.positionAt(offset + 1)
          const bodyRange = new vscode.Range(taskInfo.taskBody.start, pos)
          taskInfo.taskBody = bodyRange
          taskInfo.taskContent = doc.getText(bodyRange)
          taskInfo.taskReferContent = doc.getText(
            new vscode.Range(taskInfo.taskProp.start.line, 0, pos.line + 1, 0)
          )
        }
      },
      onSeparator: (character, offset, length, startLine, startCharacter) => {
        if (character === ',') {
          if (typeof path[path.length - 1] === 'number') {
            ;(path[path.length - 1] as number)++
          }
        } else if (character === ':') {
        }
      },
      onArrayBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
        path.push(0)
      },
      onArrayEnd: (offset, length, startLine, startCharacter) => {
        path.pop()
      },
      onLiteralValue: (value, offset, length, startLine, startCharacter, pathSupplier) => {
        if (typeof path[1] !== 'string') {
          return
        }
        if (typeof value === 'string') {
          switch (path[1]) {
            case 'next':
            case 'timeout_next':
            case 'runout_next':
              if (path.length >= 2 && path.length <= 3) {
                this.taskIndex[path[0]].taskRef.push({
                  task: value,
                  range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                })
              }
              break
            case 'target':
            case 'begin':
            case 'end':
              if (path.length === 2) {
                this.taskIndex[path[0]].taskRef.push({
                  task: value,
                  range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                })
              }
              break
            case 'template':
              if (path.length >= 2 && path.length <= 3) {
                const root = this.shared(PipelineRootStatusProvider).activateResource
                if (root) {
                  const imageUri = vscode.Uri.joinPath(root[0], 'image', value)
                  this.taskIndex[path[0]].imageRef.push({
                    uri: imageUri,
                    range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                  })
                }
              }
              break
          }
        }
      }
    })
  }

  async loadTask(dir: vscode.Uri) {
    for (const [name, type] of await vscode.workspace.fs.readDirectory(dir)) {
      const subUri = vscode.Uri.joinPath(dir, name)
      if (type === vscode.FileType.File) {
        if (name.endsWith('.json')) {
          await this.loadJson(subUri)
        }
      } else if (type === vscode.FileType.Directory) {
        await this.loadTask(subUri)
      }
    }
  }

  async updateTaskIndex(root: ResourceRoot | null) {
    this.taskIndex = {}
    this.fileIndex = {}
    if (this.watcher) {
      this.watcher.dispose()
      this.watcher = null
    }
    if (root) {
      this.watcher = vscode.workspace.createFileSystemWatcher(
        this.shared(PipelineRootStatusProvider).jsonPattern()!
      )
      this.watcher.onDidChange(uri => this.dirtyUri.set(uri.fsPath, uri))
      this.watcher.onDidCreate(uri => this.dirtyUri.set(uri.fsPath, uri))
      this.watcher.onDidDelete(uri => this.dirtyUri.set(uri.fsPath, uri))
      await this.loadTask(vscode.Uri.joinPath(root[0], 'pipeline'))
    }
  }

  async updateDiagnostic() {
    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []
    for (const [task, taskInfo] of Object.entries(this.taskIndex)) {
      // check conflict task
      const m = /(.+)@VSCEXT_CONFLICT,\d+/.exec(task)
      if (m) {
        result.push([
          taskInfo.uri,
          new vscode.Diagnostic(
            taskInfo.taskProp,
            `Maa: Conflict task ${m[1]}, previous defined in ${this.shared(
              PipelineRootStatusProvider
            ).relativePathToRoot(this.taskIndex[m[1]].uri)}`,
            vscode.DiagnosticSeverity.Error
          )
        ])
      }

      // check missing task
      for (const ref of taskInfo.taskRef) {
        if (!(ref.task in this.taskIndex)) {
          result.push([
            taskInfo.uri,
            new vscode.Diagnostic(
              ref.range,
              `Maa: Unknown task ${ref.task}`,
              vscode.DiagnosticSeverity.Error
            )
          ])
        }
      }

      // check missing image
      for (const ref of taskInfo.imageRef) {
        if (!(await exists(ref.uri))) {
          result.push([
            taskInfo.uri,
            new vscode.Diagnostic(
              ref.range,
              `Maa: Unknown image ${this.shared(PipelineRootStatusProvider).relativePathToRoot(ref.uri)}`,
              vscode.DiagnosticSeverity.Error
            )
          ])
        }
      }
    }
    this.diagnostic.set(result.map(([uri, diag]) => [uri, [diag]]))
  }

  async flushDirty() {
    if (this.flushingDirty) {
      return
    }

    this.flushingDirty = true
    const dirtyUriList = this.dirtyUri
    this.dirtyUri = new Map()

    for (const [path] of dirtyUriList) {
      const tasks = this.fileIndex[path] ?? []
      delete this.fileIndex[path]
      for (const task of tasks) {
        delete this.taskIndex[task]
      }
    }

    await Promise.all([...dirtyUriList].map(([path, uri]) => this.loadJson(uri)))

    await this.updateDiagnostic()

    this.flushingDirty = false
  }

  async queryLocation(uri: vscode.Uri, pos: vscode.Position): Promise<QueryResult | null> {
    await this.flushDirty()
    for (const task of this.fileIndex[uri.fsPath] ?? []) {
      const info = this.taskIndex[task]
      if (info.taskProp.contains(pos)) {
        return {
          type: 'task.prop',
          task: task,
          range: info.taskProp,
          target: task.replace(/@VSCEXT.+$/, '')
        }
      } else if (info.taskBody.contains(pos)) {
        for (const ref of info.taskRef) {
          if (ref.range.contains(pos)) {
            return {
              type: 'task.ref',
              task: task,
              range: ref.range,
              target: ref.task
            }
          }
        }
        for (const ref of info.imageRef) {
          if (ref.range.contains(pos)) {
            return {
              type: 'image.ref',
              task: task,
              range: ref.range,
              target: ref.uri
            }
          }
        }
        return {
          type: 'task.body',
          task: task,
          range: info.taskBody
        }
      }
    }
    return null
  }

  async queryTaskData(task: string): Promise<maa.TaskDecl> {
    await this.flushDirty()
    try {
      return JSON.parse(this.taskIndex[task]?.taskContent ?? '{}')
    } catch (_) {
      return {}
    }
  }

  async queryTaskDoc(task: string): Promise<vscode.MarkdownString> {
    await this.flushDirty()
    const taskInfo = this.taskIndex[task]
    if (taskInfo) {
      return new vscode.MarkdownString(`\`\`\`json\n${taskInfo.taskReferContent}\n\`\`\``)
    } else {
      return new vscode.MarkdownString(vscode.l10n.t('maa.pipeline.error.unknown-task', task))
    }
  }
}
