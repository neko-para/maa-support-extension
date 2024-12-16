import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { Service } from '../data'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'

export type QueryResult =
  | {
      type: 'task.entry'
      task: string
      range: vscode.Range
    }
  | {
      type: 'task.option'
      range: vscode.Range
      option: string
    }

export class ProjectInterfaceIndexerProvider extends Service {
  interfaceUri: vscode.Uri | null = null

  taskEntry: {
    range: vscode.Range
    task: string
  }[] = []
  optionEntry: {
    range: vscode.Range
    option: string
  }[] = []
  optionDecl: {
    range: vscode.Range
    option: string
  }[] = []

  constructor() {
    super()

    this.shared(PipelineProjectInterfaceProvider).event.on('activateInterfaceChanged', () => {
      const root = this.shared(PipelineRootStatusProvider).activateResource
      if (root) {
        this.loadJson(root.interfaceUri)
      }
    })
  }

  async loadJson(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri)
    if (!doc) {
      return
    }
    this.interfaceUri = uri

    this.taskEntry = []

    visitJsonDocument(doc, {
      onLiteral: (value, range, path) => {
        if (typeof value === 'string') {
          switch (path[0]) {
            case 'task':
              if (typeof path[1] === 'number') {
                switch (path[2]) {
                  case 'entry':
                    if (path.length === 3) {
                      this.taskEntry.push({
                        range,
                        task: value
                      })
                    }
                    break
                  case 'option':
                    if (typeof path[3] === 'number' && path.length === 4) {
                      this.optionEntry.push({
                        range,
                        option: value
                      })
                    }
                    break
                }
              }
              break
          }
        }
      },
      onObjectProp: (prop, range, path) => {
        switch (path[0]) {
          case 'task':
            if (typeof path[1] === 'number') {
              switch (path[2]) {
                case 'pipeline_override':
                  if (typeof path[3] === 'string' && path.length === 4) {
                    this.taskEntry.push({
                      range,
                      task: path[3]
                    })
                  }
                  break
              }
            }
            break
          case 'option':
            if (typeof path[1] === 'string' && path.length === 2) {
              this.optionDecl.push({
                range,
                option: path[1]
              })
            }
        }
      }
    })
  }

  queryLocation(document: vscode.Uri, pos: vscode.Position): QueryResult | null {
    if (document.fsPath !== this.interfaceUri?.fsPath) {
      return null
    }

    for (const entry of this.taskEntry) {
      if (entry.range.contains(pos)) {
        return {
          type: 'task.entry',
          task: entry.task,
          range: entry.range
        }
      }
    }

    for (const entry of this.optionEntry) {
      if (entry.range.contains(pos)) {
        return {
          type: 'task.option',
          range: entry.range,
          option: entry.option
        }
      }
    }

    return null
  }
}
