import { existsSync } from 'fs'
import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { FSWatchFlushHelper } from './flush'
import { PipelineLayer, TaskIndexInfo } from './types'

export class TaskLayer extends FSWatchFlushHelper implements PipelineLayer {
  uri: vscode.Uri
  level: number
  index: Record<string, TaskIndexInfo[]>

  constructor(uri: vscode.Uri, level: number) {
    super(new vscode.RelativePattern(uri, 'pipeline/**/*.{json,jsonc}'), u => {
      return (
        u.fsPath.startsWith(uri.fsPath) &&
        (u.fsPath.endsWith('.json') || u.fsPath.endsWith('.jsonc'))
      )
    })

    this.uri = uri
    this.level = level

    this.index = {}

    this.loadDir(this.uri)
  }

  async doUpdate(dirtyPath: string[]) {
    const newIndex: Record<string, TaskIndexInfo[]> = {}
    for (const [task, infos] of Object.entries(this.index)) {
      newIndex[task] = infos.filter(info => dirtyPath.includes(info.uri.fsPath))
    }
    this.index = newIndex
    for (const file of dirtyPath) {
      if (existsSync(file)) {
        this.loadJson(vscode.Uri.file(file))
      }
    }
  }

  async loadDir(dir: vscode.Uri) {
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
  }

  async loadJson(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri)
    if (!doc) {
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
        return {
          uri,
          taskContent: '',
          taskReferContent: '',
          taskProp: range,
          taskBody: new vscode.Range(0, 0, 0, 0),
          taskRef: [],
          imageRef: []
        }
      },
      onObjectEnd: (range, path, state) => {
        if (path.length !== 1 || !state) {
          return
        }
        state.taskBody = range
        state.taskContent = doc.getText(range)
        state.taskReferContent = doc.getText(
          new vscode.Range(state.taskProp.start.line, 0, state.taskProp.end.line + 1, 0)
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

        switch (path[1]) {
          case 'next':
          case 'interrupt':
          case 'on_error':
          case 'timeout_next':
            if (path.length >= 2 && path.length <= 3) {
              state.taskRef.push({
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
              state.taskRef.push({
                task: value,
                range: range,
                belong: 'target'
              })
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
          case 'pre_wait_freezes':
          case 'post_wait_freezes':
            switch (path[2]) {
              case 'target':
                if (path.length == 3) {
                  state.taskRef.push({
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
                    state.taskRef.push({
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
    })
  }
}
