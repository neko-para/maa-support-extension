import { existsSync } from 'fs'
import path from 'path'
import * as vscode from 'vscode'

import { JSONPath, visitJsonDocument } from '@mse/utils'

import { context, diagnosticService } from '..'
import {
  currentWorkspace,
  imageSuffix,
  isMaaAssistantArknights,
  pipelineSuffix
} from '../../utils/fs'
import { PipelineLayer, TaskBelong, TaskIndexInfo } from '../types'
import { FSWatchFlushHelper } from '../utils/flush'

function addTaskRef(
  state: TaskIndexInfo,
  task: string,
  range: vscode.Range,
  belong: TaskBelong,
  acceptAttr = false
) {
  if (!isMaaAssistantArknights) {
    if (acceptAttr) {
      const match = /^((?:\[.+\])*)(.+)$/.exec(task)
      if (match) {
        const isAnchor = /\[Anchor\]/.test(match[1])
        if (isAnchor) {
          state.anchorRef.push({
            anchor: match[2],
            range: new vscode.Range(range.start.translate(0, match[1].length + 1), range.end)
          })
        } else {
          state.taskRef.push({
            task: match[2],
            range: new vscode.Range(range.start.translate(0, match[1].length + 1), range.end),
            belong,
            attr: acceptAttr
          })
        }
        return
      }
    }

    state.taskRef.push({
      task,
      range,
      belong,
      attr: acceptAttr
    })
    return
  }

  // 提供给自动补全使用
  if (task === '') {
    state.taskRef.push({
      task,
      range,
      belong
    })
    return
  }

  const line = range.start.line
  const base = range.start.character + 1
  const makeRange = (left: number, right: number) => {
    return new vscode.Range(line, base + left, line, base + right)
  }

  const regex = /[ ()+^*]*([^ ()+^*]+)/dg
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(task))) {
    const sec = match[1]
    if (/^[0-9]+$/.test(sec)) {
      continue
    }
    let [left, right] = match.indices![1]

    // #@触发补全，添加一个假task
    if (sec.endsWith('#')) {
      state.taskRef.push({
        task: '__VSCE__MAA__SUFFIX__',
        range: makeRange(right, right),
        belong: 'maa.custom',
        fake: 'maa.#'
      })
      return
    } else if (sec.endsWith('@')) {
      state.taskRef.push({
        task: '__VSCE__MAA__EXTEND__',
        range: makeRange(right, right),
        belong: 'maa.custom',
        fake: 'maa.@'
      })
      return
    }

    const [main, suffix] = sec.split('#')
    if (!main || main.endsWith('@')) {
      continue
    }
    if (suffix) {
      right -= suffix.length + 1
    }
    state.taskRef.push({
      task: main,
      range: makeRange(left, right),
      belong
    })
  }
}

function parseReco(value: string, range: vscode.Range, path: JSONPath, state: TaskIndexInfo) {
  switch (path[1]) {
    case 'roi':
      if (path.length === 2) {
        addTaskRef(state, value, range, 'target')
      }
      break
    case 'template':
      if (path.length >= 2 && path.length <= 3) {
        state.imageRef.push({
          path: value,
          range: range
        })
      }
      break
    case 'all_of':
    case 'any_of':
      if (typeof path[2] === 'number') {
        parseReco(value, range, path.slice(2), state)
      }
      break
  }
}

function parseAct(value: string, range: vscode.Range, path: JSONPath, state: TaskIndexInfo) {
  switch (path[1]) {
    case 'target':
    case 'begin':
    case 'end':
      if (path.length === 2) {
        addTaskRef(state, value, range, 'target')
      }
      break
    case 'swipes':
      if (typeof path[2] === 'number') {
        switch (path[3]) {
          case 'begin':
          case 'end':
            if (path.length === 4) {
              addTaskRef(state, value, range, 'target')
            }
            break
        }
      }
      break
  }
}

export function parsePipelineLiteral(
  value: string,
  range: vscode.Range,
  path: JSONPath,
  state: TaskIndexInfo
) {
  switch (path[1]) {
    case 'baseTask':
      if (isMaaAssistantArknights) {
        if (path.length === 2) {
          addTaskRef(state, value, range, 'maa.custom')
        }
      }
      break
    case 'sub':
    case 'onErrorNext':
    case 'exceededNext':
    case 'reduceOtherTimes':
      if (isMaaAssistantArknights) {
        if (path.length >= 2 && path.length <= 3) {
          addTaskRef(state, value, range, 'maa.custom')
        }
      }
      break
    case 'next':
    case 'interrupt':
    case 'on_error':
      if (path.length >= 2 && path.length <= 3) {
        addTaskRef(state, value, range, 'next', true)
      }
      // else if (path.length === 4 && path[3] === 'name') {
      //   addTaskRef(state, value, range, 'next')
      // }
      break
    case 'pre_wait_freezes':
    case 'post_wait_freezes':
      switch (path[2]) {
        case 'target':
          if (path.length == 3) {
            addTaskRef(state, value, range, 'target')
          }
          break
      }
      break
    case 'anchor':
      if (path.length === 2) {
        state.anchor = {
          name: value,
          range
        }
      }
      break
  }
  parseReco(value, range, path, state)
  parseAct(value, range, path, state)
  if (path[1] === 'recognition' && path[2] === 'param') {
    parseReco(value, range, path.slice(2), state)
  }
  if (path[1] === 'action' && path[2] === 'param') {
    parseAct(value, range, path.slice(2), state)
  }
}

class ImageIndex {
  uri: vscode.Uri
  images: {
    uri: vscode.Uri
    relative: string
  }[]
  acceptRefresh: boolean = true
  previousRefresh?: Promise<void>

  watcher: vscode.FileSystemWatcher

  constructor(uri: vscode.Uri) {
    this.uri = uri
    this.images = []
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(currentWorkspace()!, '**/*.png')
    )
    context.subscriptions.push(this.watcher)

    const base = vscode.Uri.joinPath(uri, imageSuffix).fsPath + path.sep
    const tester = (u: vscode.Uri) => {
      return u.fsPath.startsWith(base) && u.fsPath.endsWith('.png')
    }

    this.watcher.onDidCreate(uri => {
      if (tester(uri)) {
        this.flushImage()
      }
    })

    this.watcher.onDidDelete(uri => {
      if (tester(uri)) {
        this.flushImage()
      }
    })

    this.watcher.onDidChange(uri => {
      if (tester(uri)) {
        this.flushImage()
      }
    })
  }

  async buildImageIndex(dir: vscode.Uri, rel: string) {
    const result: {
      uri: vscode.Uri
      relative: string
    }[] = []
    for (const [file, type] of await vscode.workspace.fs.readDirectory(dir)) {
      if (type === vscode.FileType.Directory) {
        result.push(
          ...(await this.buildImageIndex(vscode.Uri.joinPath(dir, file), path.join(rel, file)))
        )
      } else if (type === vscode.FileType.File) {
        if (file.endsWith('.png')) {
          result.push({
            uri: vscode.Uri.joinPath(dir, file),
            relative: path.join(rel, file).replaceAll(path.sep, '/')
          })
        }
      }
    }
    return result
  }

  async flushImageImpl() {
    this.images = await this.buildImageIndex(vscode.Uri.joinPath(this.uri, imageSuffix), '')

    diagnosticService.scanner.scheduleFlush()
  }

  flushImage() {
    if (!this.acceptRefresh) {
      return this.previousRefresh ?? Promise.resolve()
    }
    this.acceptRefresh = false
    this.previousRefresh = this.flushImageImpl()
    setTimeout(() => {
      this.acceptRefresh = true
      this.previousRefresh = undefined
    }, 10000)
    return this.previousRefresh
  }
}

export class TaskLayer extends FSWatchFlushHelper implements PipelineLayer {
  uri: vscode.Uri
  level: number
  index: Record<string, TaskIndexInfo[]>
  imageIndex: ImageIndex

  constructor(uri: vscode.Uri, level: number) {
    const base = vscode.Uri.joinPath(uri, pipelineSuffix).fsPath + path.sep
    super(new vscode.RelativePattern(currentWorkspace()!, '**/*.{json,jsonc}'), u => {
      return (
        u.fsPath.startsWith(base) && (u.fsPath.endsWith('.json') || u.fsPath.endsWith('.jsonc'))
      )
    })

    this.uri = uri
    this.level = level
    this.index = {}

    this.imageIndex = new ImageIndex(this.uri)
  }

  async init() {
    await this.loadDir(vscode.Uri.joinPath(this.uri, pipelineSuffix))
  }

  async doUpdate(dirtyPath: string[]) {
    if (dirtyPath.length === 0) {
      return
    }

    const newIndex: Record<string, TaskIndexInfo[]> = {}
    for (const [task, infos] of Object.entries(this.index)) {
      newIndex[task] = infos.filter(info => !dirtyPath.includes(info.uri.fsPath))
    }
    this.index = newIndex
    for (const file of dirtyPath) {
      if (existsSync(file)) {
        await this.loadJson(vscode.Uri.file(file))
      }
    }

    diagnosticService.scanner.scheduleFlush()
  }

  async loadDir(dir: vscode.Uri) {
    try {
      for (const [name, type] of await vscode.workspace.fs.readDirectory(dir)) {
        const subUri = vscode.Uri.joinPath(dir, name)
        if (type === vscode.FileType.File) {
          if (name.endsWith('.json') || name.endsWith('.jsonc')) {
            await this.loadJson(subUri)
          }
        } else if (type === vscode.FileType.Directory) {
          await this.loadDir(subUri)
        }
      }
    } catch {}
  }

  async loadJson(uri: vscode.Uri) {
    let doc: vscode.TextDocument | null = null
    try {
      doc = await vscode.workspace.openTextDocument(uri)
    } catch {
      return
    }

    const addTask = (task: string, info: TaskIndexInfo) => {
      this.index[task] = (this.index[task] ?? []).concat(info)
    }

    visitJsonDocument<TaskIndexInfo>(doc, {
      onObjectProp: (prop, range, path) => {
        if (path.length !== 1) {
          return undefined
        }
        if (path[0].toString().startsWith('$')) {
          return undefined
        }
        return {
          uri,
          taskContent: '',
          taskReferContent: '',
          taskProp: range,
          taskBody: new vscode.Range(0, 0, 0, 0),
          taskRef: [],
          imageRef: [],
          anchorRef: []
        }
      },
      onObjectEnd: (range, path, state) => {
        if (path.length !== 1 || !state) {
          return
        }
        state.taskBody = range
        state.taskContent = doc.getText(range)
        state.taskReferContent = doc.getText(
          new vscode.Range(state.taskProp.start.line, 0, range.end.line + 1, 0)
        )

        addTask(path[0].toString(), state)
      },
      onLiteral: (value, range, path, state) => {
        if (typeof path[1] !== 'string' || typeof value !== 'string') {
          return
        }
        if (!state) {
          return
        }

        parsePipelineLiteral(value, range, path, state)
      }
    })
  }

  get images() {
    return this.imageIndex.images
  }

  flushImage() {
    return this.imageIndex.flushImage()
  }
}
