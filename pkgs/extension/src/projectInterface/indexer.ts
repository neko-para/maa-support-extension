import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { Service } from '../data'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { ProjectInterfaceJsonProvider } from './json'

export type QueryResult =
  | {
      type: 'option.ref'
      range: vscode.Range
      option: string
    }
  | {
      type: 'case.ref'
      range: vscode.Range
      option: string
      case: string
    }

export class ProjectInterfaceIndexerProvider extends Service {
  interfaceUri: vscode.Uri | null = null

  refs: QueryResult[] = []
  entryDecl: {
    range: vscode.Range
    name: string
  }[] = []
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

    this.shared(ProjectInterfaceJsonProvider).event.on('interfaceChanged', () => {
      const root = this.shared(PipelineRootStatusProvider).activateResource.value
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

    this.refs = []
    this.optionDecl = []
    this.caseDecl = []

    visitJsonDocument(doc, {
      onLiteral: (value, range, path) => {
        if (typeof value === 'string') {
          switch (path[0]) {
            case 'task':
              if (typeof path[1] === 'number') {
                switch (path[2]) {
                  case 'name':
                    if (path.length === 3) {
                      this.entryDecl.push({
                        range,
                        name: value
                      })
                    }
                    break
                  case 'option':
                    if (typeof path[3] === 'number' && path.length === 4) {
                      this.refs.push({
                        type: 'option.ref',
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
                      this.refs.push({
                        type: 'case.ref',
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
      }
    })
  }

  queryLocation(document: vscode.Uri, pos: vscode.Position): QueryResult | null {
    if (document.fsPath !== this.interfaceUri?.fsPath) {
      return null
    }

    for (const entry of this.refs) {
      if (entry.range.contains(pos)) {
        return entry
      }
    }

    return null
  }
}
