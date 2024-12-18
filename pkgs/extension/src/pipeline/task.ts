import { watch, watchEffect } from 'reactive-vscode'
import * as vscode from 'vscode'

import { JSONPath, logger, t, visitJsonDocument, vscfs } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { ProjectInterfaceJsonProvider } from '../projectInterface/json'
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
    belong: 'next' | 'target'
  }[]
  imageRef: {
    path: string
    range: vscode.Range
  }[]
}

interface PipelineLayer {
  uri: vscode.Uri
  level: number
  taskIndex: Record<string, TaskIndexInfo[]>

  flushDirty(): Promise<void>
}

class PipelineTaskIndexLayer extends Service implements PipelineLayer {
  uri: vscode.Uri
  level: number
  taskIndex: Record<string, TaskIndexInfo[]>

  watcher: vscode.FileSystemWatcher
  dirtyUri: Set<string>

  flushing: boolean
  needReflush: boolean

  constructor(uri: vscode.Uri, level: number) {
    super()

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

          this.taskIndex[path[0]] = [...(this.taskIndex[path[0]] ?? []), taskInfo]
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
            case 'on_error':
            case 'timeout_next':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range,
                  belong: 'next'
                })
              }
              break
            case 'target':
            case 'begin':
            case 'end':
              if (path.length === 2) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range,
                  belong: 'target'
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
            case 'pre_wait_freezes':
            case 'post_wait_freezes':
              switch (path[2]) {
                case 'target':
                  if (path.length == 3) {
                    taskInfo.taskRef.push({
                      task: value,
                      range: range,
                      belong: 'target'
                    })
                  }
                  break
              }
              break
            case 'swipes':
              if (typeof path[2] === 'number') {
                switch (path[3]) {
                  case 'begin':
                  case 'end':
                    if (path.length === 4) {
                      taskInfo.taskRef.push({
                        task: value,
                        range: range,
                        belong: 'target'
                      })
                    }
                    break
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

  async flushDirty() {
    if (this.flushing) {
      this.needReflush = true
      return
    }
    this.flushing = true

    const dirtyList = this.dirtyUri
    this.dirtyUri = new Set()

    const newTaskIndex: Record<string, TaskIndexInfo[]> = {}
    for (const [task, infos] of Object.entries(this.taskIndex)) {
      newTaskIndex[task] = infos.filter(info => !dirtyList.has(info.uri.fsPath))
    }

    this.taskIndex = newTaskIndex

    for (const path of dirtyList) {
      // 有可能是delete
      if (await vscfs.exists(vscode.Uri.file(path))) {
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

class PipelineInterfaceIndexLayer extends Service implements PipelineLayer {
  uri: vscode.Uri
  level: number
  taskIndex: Record<string, TaskIndexInfo[]>

  watcher: vscode.FileSystemWatcher
  dirty: boolean

  flushing: boolean
  needReflush: boolean

  constructor(uri: vscode.Uri, level: number) {
    super()

    this.uri = vscode.Uri.joinPath(uri, 'interface.json')
    this.level = level
    this.taskIndex = {}
    this.defer = this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(uri, 'interface.json')
    )
    this.dirty = false
    this.flushing = false
    this.needReflush = false

    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.fsPath === this.uri.fsPath) {
        this.dirty = true
      }
    })
    this.watcher.onDidChange(event => {
      this.dirty = true
    })

    this.loadJson()
  }

  async loadJson() {
    const doc = await vscode.workspace.openTextDocument(this.uri)
    if (!doc) {
      return
    }

    const stripPath = (path: JSONPath, prefix: { value: string }): JSONPath => {
      if (path[0] === 'task' && typeof path[1] === 'number' && path[2] === 'pipeline_override') {
        prefix.value = `task${path[1]}@`
        return path.slice(3)
      }
      if (
        path[0] === 'option' &&
        typeof path[1] === 'string' &&
        path[2] === 'cases' &&
        typeof path[3] === 'number' &&
        path[4] === 'pipeline_override'
      ) {
        prefix.value = `case${path[1]}${path[3]}@`
        return path.slice(5)
      }
      return []
    }

    let taskInfo: TaskIndexInfo | null = null
    let entryTaskInfo: TaskIndexInfo = {
      uri: this.uri,
      taskContent: '',
      taskReferContent: '',
      taskProp: new vscode.Range(0, 0, 0, 0),
      taskBody: new vscode.Range(0, 0, 0, 0),
      taskRef: [],
      imageRef: []
    }

    this.taskIndex['@VSCEXT_INTERFACE'] = [entryTaskInfo]

    visitJsonDocument(doc, {
      onObjectProp: (prop, range, path) => {
        const prefix = { value: '' }
        path = stripPath(path, prefix)
        if (path.length === 0) {
          return
        }

        if (path.length === 1) {
          taskInfo = {
            uri: this.uri,
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
        const prefix = { value: '' }
        path = stripPath(path, prefix)
        if (path.length === 0) {
          return
        }

        if (path.length === 1) {
          if (!taskInfo) {
            return
          }
          taskInfo.taskBody = range
          taskInfo.taskContent = doc.getText(range)
          taskInfo.taskReferContent = doc.getText(
            new vscode.Range(taskInfo.taskProp.start.line, 0, range.end.line + 1, 0)
          )

          this.taskIndex[path[0]] = [...(this.taskIndex[path[0]] ?? []), taskInfo]
          taskInfo = null
        }
      },
      onArrayEnd: (range, path) => {
        if (path[0] === 'task' && path.length === 1) {
          entryTaskInfo.taskBody = range
        }
      },
      onLiteral: (value, range, path) => {
        if (typeof value === 'string') {
          switch (path[0]) {
            case 'task':
              if (typeof path[1] === 'number') {
                switch (path[2]) {
                  case 'entry':
                    if (path.length === 3) {
                      entryTaskInfo.taskRef.push({
                        task: value,
                        range: range,
                        belong: 'target'
                      })
                    }
                    break
                }
              }
          }
        }

        const prefix = { value: '' }
        path = stripPath(path, prefix)
        if (path.length === 0) {
          return
        }

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
            case 'on_error':
            case 'timeout_next':
              if (path.length >= 2 && path.length <= 3) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range,
                  belong: 'next'
                })
              }
              break
            case 'target':
            case 'begin':
            case 'end':
              if (path.length === 2) {
                taskInfo.taskRef.push({
                  task: value,
                  range: range,
                  belong: 'target'
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
            case 'pre_wait_freezes':
            case 'post_wait_freezes':
              switch (path[2]) {
                case 'target':
                  if (path.length == 3) {
                    taskInfo.taskRef.push({
                      task: value,
                      range: range,
                      belong: 'target'
                    })
                  }
                  break
              }
              break
            case 'swipes':
              if (typeof path[2] === 'number') {
                switch (path[3]) {
                  case 'begin':
                  case 'end':
                    if (path.length === 4) {
                      taskInfo.taskRef.push({
                        task: value,
                        range: range,
                        belong: 'target'
                      })
                    }
                    break
                }
              }
              break
          }
        }
      }
    })
  }

  async flushDirty() {
    if (this.flushing) {
      this.needReflush = true
      return
    }
    this.flushing = true

    this.dirty = false

    this.taskIndex = {}

    await this.loadJson()

    this.flushing = false
    if (this.needReflush) {
      this.needReflush = false
      this.flushDirty()
    }
  }
}

export class PipelineTaskIndexProvider extends Service {
  layers: PipelineTaskIndexLayer[]
  interfaceLayer?: PipelineInterfaceIndexLayer
  diagnostic: vscode.DiagnosticCollection
  currentDiagnosticUris: vscode.Uri[]

  updateingDiag: boolean

  constructor() {
    super()

    this.layers = []
    this.diagnostic = vscode.languages.createDiagnosticCollection('maa')
    this.currentDiagnosticUris = []
    this.updateingDiag = false

    watch(
      () => {
        return this.shared(ProjectInterfaceJsonProvider).resourceKey.value
      },
      () => {
        for (const layer of this.layers) {
          layer.dispose()
        }
        this.layers = this.shared(ProjectInterfaceJsonProvider).resourcePaths.value.map(
          (x, i) => new PipelineTaskIndexLayer(x, i)
        )
      }
    )

    watchEffect(() => {
      const root = this.shared(PipelineRootStatusProvider).activateResource.value
      this.interfaceLayer?.dispose()
      if (root) {
        this.interfaceLayer = new PipelineInterfaceIndexLayer(
          root.dirUri,
          this.shared(ProjectInterfaceJsonProvider).resourcePaths.value.length
        )
      }
    })

    this.defer = (() => {
      const timer = setInterval(() => {
        this.updateDiagnostic()
      }, 1000)
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

  get allLayers(): PipelineLayer[] {
    return [...this.layers, ...(this.interfaceLayer ? [this.interfaceLayer] : [])]
  }

  async updateDiagnostic() {
    if (this.updateingDiag) {
      return
    }
    this.updateingDiag = true

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []
    for (const layer of this.allLayers) {
      for (const [task, taskInfos] of Object.entries(layer.taskIndex)) {
        // check conflict task
        if (taskInfos.length > 1 && layer !== this.interfaceLayer) {
          // interface layer contains same override
          for (const taskInfo of taskInfos.slice(1)) {
            result.push([
              taskInfo.uri,
              new vscode.Diagnostic(
                taskInfo.taskProp,
                t(
                  'maa.pipeline.error.conflict-task',
                  task,
                  this.shared(PipelineRootStatusProvider).relativePathToRoot(taskInfos[0].uri)
                ),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }

        for (const taskInfo of taskInfos) {
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

          // check duplicate next task
          const nextRefs = taskInfo.taskRef.filter(x => x.belong === 'next')
          const nextFirst: Set<string> = new Set()
          for (const ref of nextRefs) {
            if (nextFirst.has(ref.task)) {
              result.push([
                taskInfo.uri,
                new vscode.Diagnostic(
                  ref.range,
                  t('maa.pipeline.error.duplicate-next', ref.task),
                  vscode.DiagnosticSeverity.Error
                )
              ])
            } else {
              nextFirst.add(ref.task)
            }
          }
        }
      }
    }
    if (result.length === 0) {
      this.diagnostic.clear()
      this.currentDiagnosticUris = []
    } else {
      const nextDiagUris: vscode.Uri[] = []
      const diagResult: [vscode.Uri, vscode.Diagnostic[]][] = []
      for (const [uri, diag] of result) {
        if (!nextDiagUris.find(x => x.fsPath === uri.fsPath)) {
          nextDiagUris.push(uri)
          diagResult.push([uri, [diag]])
        } else {
          diagResult.find(x => x[0].fsPath === uri.fsPath)?.[1].push(diag)
        }
      }
      const needClear = this.currentDiagnosticUris.filter(
        x => !nextDiagUris.find(y => y.fsPath === x.fsPath)
      )
      diagResult.push(...needClear.map(x => [x, []] as [vscode.Uri, vscode.Diagnostic[]]))
      this.currentDiagnosticUris = nextDiagUris

      this.diagnostic.set(diagResult)
    }

    this.updateingDiag = false
  }

  async flushDirty() {
    for (const layer of this.allLayers) {
      await layer.flushDirty()
    }
  }

  getLayer(uri: vscode.Uri) {
    for (const layer of this.layers) {
      if (uri.fsPath.startsWith(layer.uri.fsPath)) {
        return layer
      }
    }
    if (this.interfaceLayer?.uri.fsPath === uri.fsPath) {
      return this.interfaceLayer
    }
    return null
  }

  async queryLocation(
    uri: vscode.Uri,
    pos: vscode.Position
  ): Promise<[QueryResult, PipelineLayer] | [null, null]> {
    await this.flushDirty()
    const layer = this.getLayer(uri)
    if (!layer) {
      return [null, null]
    }
    for (const [task, infos] of Object.entries(layer.taskIndex)) {
      for (const info of infos) {
        if (info.uri.fsPath !== uri.fsPath) {
          continue
        }
        if (info.taskProp.contains(pos)) {
          return [
            {
              type: 'task.prop',
              task: task,
              range: info.taskProp,
              target: task
            },
            layer
          ]
        } else if (info.taskBody.contains(pos)) {
          for (const ref of info.taskRef) {
            if (ref.range.contains(pos)) {
              return [
                {
                  type: 'task.ref',
                  task: task,
                  range: ref.range,
                  target: ref.task
                },
                layer
              ]
            }
          }
          for (const ref of info.imageRef) {
            if (ref.range.contains(pos)) {
              return [
                {
                  type: 'image.ref',
                  task: task,
                  range: ref.range,
                  target: ref.path
                },
                layer
              ]
            }
          }
          return [
            {
              type: 'task.body',
              task: task,
              range: info.taskBody
            },
            layer
          ]
        }
      }
    }
    return [null, null]
  }

  async queryTask(task: string, level?: number, pos?: vscode.Position) {
    const allLayers = this.allLayers

    await this.flushDirty()
    if (level === undefined) {
      level = allLayers.length
    }
    const result: {
      uri: vscode.Uri
      info: TaskIndexInfo
    }[] = []
    try {
      for (const layer of allLayers.slice(0, level)) {
        if (task in layer.taskIndex) {
          for (const info of layer.taskIndex[task]) {
            if (layer.taskIndex[task].length > 1 && pos && !info.taskProp.contains(pos)) {
              continue
            }
            result.push({
              uri: layer.uri,
              info: info
            })
          }
        }
      }
    } catch (_) {}
    return result
  }

  async queryImage(image: string, level?: number) {
    const allLayers = this.allLayers

    await this.flushDirty()
    if (level === undefined) {
      level = allLayers.length
    }
    const result: {
      uri: vscode.Uri
      info: {
        uri: vscode.Uri
      }
    }[] = []
    try {
      for (const layer of allLayers.slice(0, level)) {
        const iu = vscode.Uri.joinPath(layer.uri, 'image', image)
        if (await vscfs.exists(iu)) {
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

  async queryTaskDoc(
    task: string,
    level?: number,
    pos?: vscode.Position
  ): Promise<vscode.MarkdownString> {
    const result = await this.queryTask(task, level, pos)
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
