import * as vscode from 'vscode'

import { visitJsonDocument } from '@mse/utils'

import { interfaceService, rootService } from '.'
import { BaseService } from './context'

export class InterfaceLocalizationService extends BaseService {
  configHash: string | null = null
  activeConfig: Record<string, vscode.Uri> = {}

  localeIndex: {
    [locale in string]: {
      [key in string]: {
        value?: string
        range?: vscode.Range
        propRange: vscode.Range
      }
    }
  } = {}

  constructor() {
    super()
    console.log('construct InterfaceLocalizationService')

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.checkLoadInterface()
    })

    this.defer = vscode.workspace.onDidChangeTextDocument(e => {
      for (const [locale, file] of Object.entries(this.activeConfig)) {
        if (e.document.uri.fsPath === file.fsPath) {
          this.update(locale, e.document)
          return
        }
      }
    })
  }

  async init() {
    console.log('init InterfaceLocalizationService')

    await this.checkLoadInterface()
  }

  async checkLoadInterface() {
    if (!rootService.activeResource) {
      return
    }

    const obj = interfaceService.interfaceJson.languages ?? {}
    const hash = JSON.stringify(Object.entries(obj).sort((a, b) => a[0].localeCompare(b[0])))
    if (this.configHash !== hash) {
      this.configHash = hash
      this.activeConfig = Object.fromEntries(
        Object.entries(obj).map(([locale, file]) => {
          return [locale, vscode.Uri.joinPath(rootService.activeResource!.dirUri, file)]
        })
      )

      await this.reload()
    }
  }

  async reload() {
    this.localeIndex = {}

    for (const [locale, file] of Object.entries(this.activeConfig)) {
      let doc: vscode.TextDocument
      try {
        doc = await vscode.workspace.openTextDocument(file)
      } catch {
        continue
      }

      this.update(locale, doc)
    }
  }

  async update(locale: string, doc: vscode.TextDocument) {
    this.localeIndex[locale] = {}

    visitJsonDocument(doc, {
      onObjectProp: (prop, range, path) => {
        if (path.length === 1) {
          this.localeIndex[locale][prop] = {
            propRange: range
          }
        }
      },
      onLiteral: (value, range, path) => {
        if (path.length === 1 && typeof path[0] === 'string' && typeof value === 'string') {
          this.localeIndex[locale][path[0]] = {
            ...this.localeIndex[locale][path[0]],
            value,
            range
          }
        }
      }
    })
  }
}
