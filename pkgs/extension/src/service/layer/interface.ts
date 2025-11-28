import path from 'path'
import * as vscode from 'vscode'

import { JSONPath, visitJsonDocument } from '@mse/utils'

import { diagnosticService } from '..'
import { currentWorkspace } from '../../utils/fs'
import { PipelineLayer, TaskIndexInfo } from '../types'
import { FSWatchFlushHelper } from '../utils/flush'
import { parsePipelineLiteral } from './task'

export class InterfaceLayer extends FSWatchFlushHelper implements PipelineLayer {
  uri: vscode.Uri
  level: number
  index: Record<string, TaskIndexInfo[]>

  images: {
    uri: vscode.Uri
    relative: string
  }[] = []

  interfaceUri: vscode.Uri

  constructor(uri: vscode.Uri, level: number) {
    super(new vscode.RelativePattern(currentWorkspace()!, 'interface.json'), u => {
      return u.fsPath === uri.fsPath
    })

    this.uri = vscode.Uri.file(path.dirname(uri.fsPath))
    this.level = level
    this.index = {}
    this.interfaceUri = uri
  }

  async init() {
    this.index = {}
    await this.loadJson()
  }

  async flushImage() {}

  async doUpdate(dirtyPath: string[]) {
    if (dirtyPath.length === 0) {
      return
    }

    this.index = {}
    await this.loadJson()

    diagnosticService.scanner.scheduleFlush()
  }

  async loadJson() {
    let doc: vscode.TextDocument | null = null
    try {
      doc = await vscode.workspace.openTextDocument(this.interfaceUri)
    } catch {
      return
    }

    const addTask = (task: string, info: TaskIndexInfo) => {
      this.index[task] = (this.index[task] ?? []).concat(info)
    }

    // 实际上prefix没用上, 先抄过来
    const stripPath = (path: JSONPath): [path: JSONPath, prefix: string] => {
      if (path[0] === 'task' && typeof path[1] === 'number' && path[2] === 'pipeline_override') {
        return [path.slice(3), `task${path[1]}@`]
      }
      if (
        path[0] === 'option' &&
        typeof path[1] === 'string' &&
        path[2] === 'cases' &&
        typeof path[3] === 'number' &&
        path[4] === 'pipeline_override'
      ) {
        return [path.slice(5), `case${path[1]}${path[3]}@`]
      } else if (
        path[0] === 'option' &&
        typeof path[1] === 'string' &&
        path[2] === 'pipeline_override'
      ) {
        return [path.slice(3), `input${path[1]}@`]
      }
      return [[], '']
    }

    const entryTaskInfo: TaskIndexInfo = {
      uri: this.interfaceUri,
      taskContent: '',
      taskReferContent: '',
      taskProp: new vscode.Range(0, 0, 0, 0),
      taskBody: new vscode.Range(0, 0, 0, 0),
      taskRef: [],
      imageRef: [],
      anchorRef: []
    }
    this.index['__VSCE__INTERFACE__'] = [entryTaskInfo]

    visitJsonDocument<TaskIndexInfo>(doc, {
      onObjectProp: (prop, range, full_path) => {
        const [path, prefix] = stripPath(full_path)
        if (path.length === 0) {
          return
        }
        if (path[0].toString().startsWith('$')) {
          return undefined
        }

        if (path.length === 1) {
          return {
            uri: this.interfaceUri,
            taskContent: '',
            taskReferContent: '',
            taskProp: range,
            taskBody: new vscode.Range(0, 0, 0, 0),
            taskRef: [],
            imageRef: [],
            anchorRef: []
          }
        }
      },
      onObjectEnd: (range, full_path, state) => {
        const [path, prefix] = stripPath(full_path)
        if (path.length === 0) {
          return
        }

        if (path.length === 1 && state) {
          state.taskBody = range
          state.taskContent = doc.getText(range)
          state.taskReferContent = doc.getText(
            new vscode.Range(state.taskProp.start.line, 0, range.end.line + 1, 0)
          )

          addTask(path[0].toString(), state)
        }
      },
      onArrayEnd: (range, path) => {
        if (path[0] === 'task' && path.length === 1) {
          entryTaskInfo.taskBody = range
        }
      },
      onLiteral: (value, range, full_path, state) => {
        if (typeof value === 'string') {
          switch (full_path[0]) {
            case 'task':
              if (typeof full_path[1] === 'number') {
                switch (full_path[2]) {
                  case 'entry':
                    if (full_path.length === 3) {
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

        const [path, prefix] = stripPath(full_path)
        if (path.length === 0) {
          return
        }

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
}
