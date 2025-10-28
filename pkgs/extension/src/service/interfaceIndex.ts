import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { interfaceService, rootService } from '.'
import { BaseService } from './context'
import { InterfaceQueryResult } from './types'

export class InterfaceIndexService extends BaseService {
  refs: InterfaceQueryResult[] = []
  resourceDecl: {
    range: vscode.Range
    name: string
  }[] = []
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
  inputDecl: {
    range: vscode.Range
    option: string
    name: string
  }[] = []

  constructor() {
    super()

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.flushDirty()
    })
  }

  async loadJson(uri: vscode.Uri) {
    let doc: vscode.TextDocument | null = null
    try {
      doc = await vscode.workspace.openTextDocument(uri)
    } catch {
      return
    }

    this.refs = []
    this.resourceDecl = []
    this.entryDecl = []
    this.optionDecl = []
    this.caseDecl = []
    this.inputDecl = []

    visitJsonDocument(doc, {
      onLiteral: (value, range, path) => {
        if (typeof value === 'string') {
          switch (path[0]) {
            case 'resource':
              if (typeof path[1] === 'number' && path[2] === 'name') {
                this.resourceDecl.push({
                  range,
                  name: value
                })
              }
              break
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
                            this.refs.push({
                              type: 'case.ref',
                              range,
                              option: path[1],
                              case: value
                            })
                          }
                          break
                        case 'options':
                          if (typeof path[5] === 'number' && path.length === 6) {
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
                  case 'input':
                    if (typeof path[3] === 'number') {
                      switch (path[4]) {
                        case 'name':
                          if (path.length === 5) {
                            this.inputDecl.push({
                              range,
                              option: path[1],
                              name: value
                            })
                          }
                      }
                    }
                    break
                    break
                }
              }
          }
        }
      },
      onObjectProp: (prop, range, path) => {
        switch (path[0]) {
          case 'option':
            if (typeof path[1] === 'string') {
              if (path.length === 2) {
                this.optionDecl.push({
                  range,
                  option: path[1]
                })
                this.refs.push({
                  type: 'option.ref',
                  range,
                  option: path[1]
                })
              }
            }
            break
        }
      }
    })
  }

  async flushDirty() {
    const root = rootService.activeResource
    if (root) {
      await this.loadJson(root.interfaceUri)
    }
  }

  async queryLocation(
    document: vscode.Uri,
    pos: vscode.Position
  ): Promise<InterfaceQueryResult | null> {
    await this.flushDirty()

    if (document.fsPath !== rootService.activeResource?.interfaceUri.fsPath) {
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
