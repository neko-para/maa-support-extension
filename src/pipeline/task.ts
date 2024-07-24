import * as maa from '@nekosu/maa-node'
import jsm from 'json-source-map'
import { JSONPath, ParseError, ParseErrorCode, parse, visit } from 'jsonc-parser'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { InheritDisposable } from '../disposable'
import { t } from '../locale'
import { ResourceRoot, exists } from '../utils/fs'
import { PipelineProjectInterfaceProvider } from './pi'
import { PipelineRootStatusProvider } from './root'
import { validateJson } from './schema/validator'

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
      target: string
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
    path: string
    range: vscode.Range
  }[]
}

class PipelineTaskIndexLayer extends Service {
  uri: vscode.Uri
  level: number
  taskIndex: Record<string, TaskIndexInfo>
  diagIndex: Record<string, vscode.Diagnostic[]> // file - diags

  watcher: vscode.FileSystemWatcher
  dirtyUri: Set<string>

  flushing: boolean
  needReflush: boolean

  constructor(context: vscode.ExtensionContext, uri: vscode.Uri, level: number) {
    super(context)

    this.uri = uri
    this.level = level
    this.taskIndex = {}
    this.diagIndex = {}
    this.defer = this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.uri, 'pipeline/**/*.json')
    )
    this.dirtyUri = new Set()
    this.flushing = false
    this.needReflush = false

    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.fsPath.startsWith(this.uri.fsPath)) {
        this.dirtyUri.add(event.document.uri.fsPath)
      }
    })
    this.watcher.onDidCreate(event => {
      this.dirtyUri.add(event.fsPath)
    })
    this.watcher.onDidDelete(event => {
      this.dirtyUri.add(event.fsPath)
    })
    this.watcher.onDidChange(event => {
      this.dirtyUri.add(event.fsPath)
    })

    this.loadTask(this.uri)
  }

  async loadJson(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri)
    if (!doc) {
      return
    }
    const content = doc.getText()
    const path: JSONPath = []

    let taskInfo: TaskIndexInfo | null = null

    const parseErrors: ParseError[] = []
    const parsedObj = parse(content, parseErrors)
    if (parseErrors.length > 0) {
      this.diagIndex[uri.fsPath] = parseErrors.map(err => {
        const errorId = {
          1: 'InvalidSymbol',
          2: 'InvalidNumberFormat',
          3: 'PropertyNameExpected',
          4: 'ValueExpected',
          5: 'ColonExpected',
          6: 'CommaExpected',
          7: 'CloseBraceExpected',
          8: 'CloseBracketExpected',
          9: 'EndOfFileExpected',
          10: 'InvalidCommentToken',
          11: 'UnexpectedEndOfComment',
          12: 'UnexpectedEndOfString',
          13: 'UnexpectedEndOfNumber',
          14: 'InvalidUnicode',
          15: 'InvalidEscapeCharacter',
          16: 'InvalidCharacter'
        }[err.error]
        return new vscode.Diagnostic(
          new vscode.Range(doc.positionAt(err.offset), doc.positionAt(err.offset + err.length)),
          t('maa.pipeline.error.parse-error', errorId)
        )
      })
    } else {
      const errors = validateJson('pipeline', parsedObj) ?? []
      const map = jsm.parse(content)
      this.diagIndex[uri.fsPath] = errors.map(err => {
        if (err.instancePath in map.pointers) {
          const info = map.pointers[err.instancePath]
          const beg = info.key ?? info.value
          const end = info.keyEnd ?? info.valueEnd
          return new vscode.Diagnostic(
            new vscode.Range(beg.line, beg.column, end.line, end.column),
            err.message ?? JSON.stringify(err)
          )
        }
        return new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          t(
            'maa.pipeline.error.validate-error',
            err.message ? err.instancePath + ' ' + err.message : JSON.stringify(err)
          )
        )
      })
    }

    visit(content, {
      onObjectProperty: (property, offset, length, startLine, startCharacter, pathSupplier) => {
        path[path.length - 1] = property
        if (path.length === 1) {
          taskInfo = {
            uri,
            taskContent: '',
            taskReferContent: '',
            taskProp: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length)),
            taskBody: new vscode.Range(0, 0, 0, 0),
            taskRef: [],
            imageRef: []
          }
        }
      },
      onObjectBegin: (offset, length, startLine, startCharacter, pathSupplier) => {
        if (path.length === 1) {
          if (!taskInfo) {
            return
          }

          const pos = doc.positionAt(offset)
          taskInfo.taskBody = new vscode.Range(pos, pos)
        }

        path.push('')
      },
      onObjectEnd: (offset, length, startLine, startCharacter) => {
        path.pop()

        if (path.length === 1) {
          if (!taskInfo) {
            return
          }
          const pos = doc.positionAt(offset + 1)
          const bodyRange = new vscode.Range(taskInfo.taskBody.start, pos)
          taskInfo.taskBody = bodyRange
          taskInfo.taskContent = doc.getText(bodyRange)
          taskInfo.taskReferContent = doc.getText(
            new vscode.Range(taskInfo.taskProp.start.line, 0, pos.line + 1, 0)
          )

          let name = path[0]

          if (name in this.taskIndex) {
            for (let i = 1; ; i++) {
              const newProp = `${name}@VSCEXT_CONFLICT,${i}`
              if (!(newProp in this.taskIndex)) {
                name = newProp
                break
              }
            }
          }

          this.taskIndex[name] = taskInfo
          taskInfo = null
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
          if (!taskInfo) {
            return
          }

          switch (path[1]) {
            case 'next':
            case 'timeout_next':
            case 'runout_next':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.taskRef.push({
                  task: value,
                  range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                })
              }
              break
            case 'target':
            case 'begin':
            case 'end':
              if (path.length === 2) {
                taskInfo.taskRef.push({
                  task: value,
                  range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                })
              }
              break
            case 'template':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.imageRef.push({
                  path: value,
                  range: new vscode.Range(doc.positionAt(offset), doc.positionAt(offset + length))
                })
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

  async flushDirty() {
    if (this.flushing) {
      this.needReflush = true
      return
    }
    this.flushing = true

    const dirtyList = this.dirtyUri
    this.dirtyUri = new Set()

    const newTaskIndex: Record<string, TaskIndexInfo> = {}
    for (const [task, info] of Object.entries(this.taskIndex)) {
      if (!dirtyList.has(info.uri.fsPath)) {
        newTaskIndex[task] = info
      }
    }
    this.taskIndex = newTaskIndex

    const newDiagIndex: Record<string, vscode.Diagnostic[]> = {}
    for (const [path, diags] of Object.entries(this.diagIndex)) {
      if (!dirtyList.has(path)) {
        newDiagIndex[path] = diags
      }
    }
    this.diagIndex = newDiagIndex

    for (const path of dirtyList) {
      // 有可能是delete
      if (await exists(vscode.Uri.file(path))) {
        await this.loadJson(vscode.Uri.file(path))
      }
    }

    this.flushing = false
    if (this.needReflush) {
      this.needReflush = false
      this.flushDirty()
    }
  }
}

export class PipelineTaskIndexProvider extends Service {
  layers: PipelineTaskIndexLayer[]
  diagnostic: vscode.DiagnosticCollection

  updateingDiag: boolean
  needReupdate: boolean

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.layers = []
    this.diagnostic = vscode.languages.createDiagnosticCollection('maa')
    this.updateingDiag = false
    this.needReupdate = false

    this.shared(PipelineProjectInterfaceProvider).event.on('activateResourceChanged', resource => {
      for (const layer of this.layers) {
        layer.dispose()
      }
      this.layers = resource.map((x, i) => new PipelineTaskIndexLayer(this.__context, x, i))
    })

    this.defer = vscode.commands.registerCommand(commands.GotoTask, async () => {
      const taskList = await this.queryTaskList()
      const result = await vscode.window.showQuickPick(taskList)
      if (result) {
        const infos = await this.queryTask(result)
        let info: TaskIndexInfo
        if (infos.length > 1) {
          const res = await vscode.window.showQuickPick(
            infos.map((info, index) => ({
              label: this.shared(PipelineRootStatusProvider).relativePath(info.info.uri),
              index: index
            }))
          )
          if (!res) {
            return
          }
          info = infos[res.index].info
        } else if (infos.length === 1) {
          info = infos[0].info
        } else {
          return
        }
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
  }

  async updateDiagnostic() {
    if (this.updateingDiag) {
      this.needReupdate = true
      return
    }
    this.updateingDiag = true

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []
    for (const layer of this.layers) {
      for (const [path, diags] of Object.entries(layer.diagIndex)) {
        const pathUri = vscode.Uri.file(path)
        for (const diag of diags) {
          result.push([pathUri, diag])
        }
      }

      for (const [task, taskInfo] of Object.entries(layer.taskIndex)) {
        // check conflict task
        const m = /(.+)@VSCEXT_CONFLICT,\d+/.exec(task)
        if (m) {
          result.push([
            taskInfo.uri,
            new vscode.Diagnostic(
              taskInfo.taskProp,
              t(
                'maa.pipeline.error.conflict-task',
                m[1],
                this.shared(PipelineRootStatusProvider).relativePathToRoot(
                  layer.taskIndex[m[1]].uri
                )
              ),
              vscode.DiagnosticSeverity.Error
            )
          ])
        }

        // check missing task
        for (const ref of taskInfo.taskRef) {
          const taskRes = await this.queryTask(ref.task, layer.level + 1)
          if (taskRes.length === 0) {
            result.push([
              taskInfo.uri,
              new vscode.Diagnostic(
                ref.range,
                t('maa.pipeline.error.unknown-task', ref.task),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }

        // check missing image
        for (const ref of taskInfo.imageRef) {
          const imageRes = await this.queryImage(ref.path, layer.level + 1)
          if (imageRes.length === 0) {
            result.push([
              taskInfo.uri,
              new vscode.Diagnostic(
                ref.range,
                t('maa.pipeline.error.unknown-image', ref.path),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }
      }
    }
    this.diagnostic.set(result.map(([uri, diag]) => [uri, [diag]]))

    this.updateingDiag = false
    if (this.needReupdate) {
      this.updateDiagnostic()
    }
  }

  async flushDirty() {
    for (const layer of this.layers) {
      await layer.flushDirty()
    }
    await this.updateDiagnostic()
  }

  getLayer(uri: vscode.Uri) {
    for (const layer of this.layers) {
      if (uri.fsPath.startsWith(layer.uri.fsPath)) {
        return layer
      }
    }
    return null
  }

  async queryLocation(uri: vscode.Uri, pos: vscode.Position): Promise<QueryResult | null> {
    await this.flushDirty()
    const layer = this.getLayer(uri)
    if (!layer) {
      return null
    }
    for (const [task, info] of Object.entries(layer.taskIndex)) {
      if (info.uri.fsPath !== uri.fsPath) {
        continue
      }
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
              target: ref.path
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

  async queryTask(task: string, level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: {
      uri: vscode.Uri
      info: TaskIndexInfo
    }[] = []
    try {
      for (const layer of this.layers.slice(0, level)) {
        if (task in layer.taskIndex) {
          result.push({
            uri: layer.uri,
            info: layer.taskIndex[task]
          })
        }
      }
    } catch (_) {}
    return result
  }

  async queryImage(image: string, level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: {
      uri: vscode.Uri
      info: {
        uri: vscode.Uri
      }
    }[] = []
    try {
      for (const layer of this.layers.slice(0, level)) {
        const iu = vscode.Uri.joinPath(layer.uri, 'image', image)
        if (await exists(iu)) {
          result.push({
            uri: layer.uri,
            info: {
              uri: iu
            }
          })
        }
      }
    } catch (_) {}
    return result
  }

  async queryTaskDoc(task: string): Promise<vscode.MarkdownString> {
    const result = await this.queryTask(task)
    if (result.length > 0) {
      return new vscode.MarkdownString(
        result
          .map(
            x =>
              `${this.shared(PipelineRootStatusProvider).relativePathToRoot(x.uri)}\n\n\`\`\`json\n${x.info.taskReferContent}\n\`\`\``
          )
          .join('\n\n')
      )
    } else {
      return new vscode.MarkdownString(t('maa.pipeline.error.unknown-task', task))
    }
  }

  async queryImageDoc(image: string): Promise<vscode.MarkdownString> {
    const result = await this.queryImage(image)
    if (result.length > 0) {
      return new vscode.MarkdownString(
        result
          .map(
            x =>
              `${this.shared(PipelineRootStatusProvider).relativePathToRoot(x.uri)}\n\n![](${x.info.uri})`
          )
          .join('\n\n')
      )
    } else {
      return new vscode.MarkdownString(t('maa.pipeline.error.unknown-image', image))
    }
  }

  async queryTaskList(level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: string[] = []
    for (const layer of this.layers.slice(0, level)) {
      result.push(...Object.keys(layer.taskIndex))
    }
    return [...new Set<string>(result)]
  }

  async queryImageList(level?: number) {
    await this.flushDirty()
    if (level === undefined) {
      level = this.layers.length
    }
    const result: string[] = []
    for (const layer of this.layers.slice(0, level)) {
      const pattern = new vscode.RelativePattern(layer.uri, 'image/**/*.png')
      result.push(
        ...(await vscode.workspace.findFiles(pattern)).map(uri =>
          this.shared(PipelineRootStatusProvider)
            .relativePathToRoot(uri, 'image', layer.uri)
            .replace(/^[\\/]/, '')
        )
      )
    }
    return [...new Set<string>(result)]
  }
}
