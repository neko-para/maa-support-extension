import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { t } from '../locale'
import { exists } from '../utils/fs'
import { visitJsonDocument } from '../utils/json'
import { PipelineProjectInterfaceProvider } from './pi'
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

  watcher: vscode.FileSystemWatcher
  dirtyUri: Set<string>

  flushing: boolean
  needReflush: boolean

  constructor(context: vscode.ExtensionContext, uri: vscode.Uri, level: number) {
    super(context)

    this.uri = uri
    this.level = level
    this.taskIndex = {}
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

    let taskInfo: TaskIndexInfo | null = null

    visitJsonDocument(doc, {
      onObjectProp: (prop, range, path) => {
        if (path.length === 1) {
          taskInfo = {
            uri,
            taskContent: '',
            taskReferContent: '',
            taskProp: range,
            taskBody: new vscode.Range(0, 0, 0, 0),
            taskRef: [],
            imageRef: []
          }
        }
      },
      onObjectEnd: (range, path) => {
        if (path.length === 1) {
          if (!taskInfo) {
            return
          }
          taskInfo.taskBody = range
          taskInfo.taskContent = doc.getText(range)
          taskInfo.taskReferContent = doc.getText(
            new vscode.Range(taskInfo.taskProp.start.line, 0, range.end.line + 1, 0)
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
      onLiteral: (value, range, path) => {
        if (typeof path[1] !== 'string') {
          return
        }
        if (typeof value === 'string') {
          if (!taskInfo) {
            return
          }

          switch (path[1]) {
            case 'next':
            case 'interrupt':
            case 'timeout_next':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range
                })
              }
              break
            case 'target':
            case 'begin':
            case 'end':
              if (path.length === 2) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range
                })
              }
              break
            case 'template':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.imageRef.push({
                  path: value,
                  range: range
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

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.layers = []
    this.diagnostic = vscode.languages.createDiagnosticCollection('maa')
    this.updateingDiag = false

    this.shared(PipelineProjectInterfaceProvider).event.on('activateResourceChanged', resource => {
      for (const layer of this.layers) {
        layer.dispose()
      }
      this.layers = resource.map((x, i) => new PipelineTaskIndexLayer(this.__context, x, i))
    })

    this.defer = (() => {
      const timer = setInterval(() => {
        this.updateDiagnostic()
      }, 500)
      return {
        dispose: () => {
          clearInterval(timer)
        }
      }
    })()

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
      return
    }
    this.updateingDiag = true

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []
    for (const layer of this.layers) {
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
    if (result.length === 0) {
      this.diagnostic.clear()
    } else {
      this.diagnostic.set(result.map(([uri, diag]) => [uri, [diag]]))
    }

    this.updateingDiag = false
  }

  async flushDirty() {
    for (const layer of this.layers) {
      await layer.flushDirty()
    }
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
