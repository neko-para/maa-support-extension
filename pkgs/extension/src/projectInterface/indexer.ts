import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { Service } from '../data'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'

export type QueryResult =
  | {
      type: 'task.entry'
      range: vscode.Range
      task: string
    }
  | {
      type: 'task.option'
      range: vscode.Range
      option: string
    }
  | {
      type: 'option.case'
      range: vscode.Range
      option: string
      case: string
    }

export class ProjectInterfaceIndexerProvider extends Service {
  interfaceUri: vscode.Uri | null = null

  entries: QueryResult[] = []
  optionDecl: {
    range: vscode.Range
    option: string
  }[] = []
  caseDecl: {
    range: vscode.Range
    option: string
    case: string
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

    this.entries = []
    this.optionDecl = []
    this.caseDecl = []

    visitJsonDocument(doc, {
      onLiteral: (value, range, path) => {
        if (typeof value === 'string') {
          switch (path[0]) {
            case 'task':
              if (typeof path[1] === 'number') {
                switch (path[2]) {
                  case 'entry':
                    if (path.length === 3) {
                      this.entries.push({
                        type: 'task.entry',
                        range,
                        task: value
                      })
                    }
                    break
                  case 'option':
                    if (typeof path[3] === 'number' && path.length === 4) {
                      this.entries.push({
                        type: 'task.option',
                        range,
                        option: value
                      })
                    }
                    break
                }
              }
              break
            case 'option':
              if (typeof path[1] === 'string') {
                switch (path[2]) {
                  case 'cases':
                    if (typeof path[3] === 'number') {
                      switch (path[4]) {
                        case 'name':
                          if (path.length === 5) {
                            this.caseDecl.push({
                              range,
                              option: path[1],
                              case: value
                            })
                          }
                      }
                    }
                    break
                  case 'default_case':
                    if (path.length === 3) {
                      this.entries.push({
                        type: 'option.case',
                        range,
                        option: path[1],
                        case: value
                      })
                    }
                    break
                }
              }
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
                    this.entries.push({
                      type: 'task.entry',
                      range,
                      task: path[3]
                    })
                  }
                  break
              }
            }
            break
          case 'option':
            if (typeof path[1] === 'string') {
              if (path.length === 2) {
                this.optionDecl.push({
                  range,
                  option: path[1]
                })
              } else {
                switch (path[2]) {
                  case 'cases':
                    if (typeof path[3] === 'number') {
                      switch (path[4]) {
                        case 'pipeline_override':
                          if (typeof path[5] === 'string' && path.length === 6) {
                            this.entries.push({
                              type: 'task.entry',
                              range,
                              task: path[5]
                            })
                          }
                          break
                      }
                    }
                    break
                }
              }
            }
            break
        }
      }
    })
  }

  queryLocation(document: vscode.Uri, pos: vscode.Position): QueryResult | null {
    if (document.fsPath !== this.interfaceUri?.fsPath) {
      return null
    }

    for (const entry of this.entries) {
      if (entry.range.contains(pos)) {
        return entry
      }
    }

    return null
  }
}
