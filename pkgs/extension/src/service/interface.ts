import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import path from 'path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig } from '@mse/types'

import { rootService } from '.'
import { BaseService } from './context'

export class InterfaceService extends BaseService {
  interfaceJson: Partial<Interface> = {}
  interfaceConfigJson: Partial<InterfaceConfig> = {}

  resourcePaths: vscode.Uri[] = []

  watchInterface?: vscode.Disposable

  interfaceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceChanged() {
    return this.interfaceChanged.event
  }

  interfaceConfigChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceConfigChanged() {
    return this.interfaceConfigChanged.event
  }

  resourceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onResourceChanged() {
    return this.resourceChanged.event
  }

  constructor() {
    super()
    console.log('construct InterfaceService')

    this.defer = this.interfaceChanged
    this.defer = this.resourceChanged

    this.defer = {
      dispose: () => {
        this.watchInterface?.dispose()
      }
    }

    this.defer = rootService.onActiveResourceChanged(() => {
      this.loadInterface()
    })

    this.defer = this.onInterfaceChanged(() => {
      this.updateResource()
    })

    this.defer = this.onInterfaceConfigChanged(() => {
      this.updateResource()
    })
  }

  async init() {
    console.log('init InterfaceService')
  }

  async loadInterface() {
    this.watchInterface?.dispose()

    this.interfaceJson = {}
    this.interfaceConfigJson = {}

    const root = rootService.activeResource
    if (!root) {
      return
    }

    const doLoadInterface = async () => {
      const doc = await vscode.workspace.openTextDocument(root.interfaceUri)
      if (!doc) {
        return
      }
      this.interfaceJson = parse(doc.getText())
      setTimeout(() => {
        this.interfaceChanged.fire()
      }, 0)
    }

    const doLoadInterfaceConfig = async () => {
      const doc = await vscode.workspace.openTextDocument(root.configUri)
      if (!doc) {
        return
      }
      this.interfaceConfigJson = parse(doc.getText())

      let fixed = false
      const tasks = this.interfaceConfigJson.task ?? []
      const fixedTasks = tasks.map(task => {
        if (!task.__vscKey) {
          fixed = true
          return {
            ...task,
            __vscKey: v4()
          }
        } else {
          return task
        }
      })
      if (fixed) {
        setTimeout(() => {
          this.reduceConfig({
            task: fixedTasks
          })
        }, 0)
      } else {
        setTimeout(() => {
          this.interfaceConfigChanged.fire()
        }, 0)
      }
    }

    this.watchInterface = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.fsPath === root.interfaceUri.fsPath) {
        doLoadInterface()
      } else if (event.document.uri.fsPath === root.configUri.fsPath) {
        doLoadInterfaceConfig()
      }
    })

    await doLoadInterface()
    await doLoadInterfaceConfig()
  }

  async saveInterfaceConfig() {
    const root = rootService.activeResource
    if (!root) {
      return
    }

    const configPath = root.configUri.fsPath
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(this.interfaceConfigJson, null, 4))
  }

  async reduceConfig(config?: Partial<InterfaceConfig>) {
    this.interfaceConfigJson = {
      ...this.interfaceConfigJson,
      ...config
    }
    await this.saveInterfaceConfig()
    this.interfaceConfigChanged.fire()
  }

  updateResource() {
    const resInfo = this.interfaceJson.resource?.find(
      x => x.name === this.interfaceConfigJson.resource
    )
    const rootPath = rootService.activeResource?.dirUri.fsPath
    if (!resInfo || !rootPath) {
      this.resourcePaths = []
    } else {
      this.resourcePaths = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
        .map(x => x.replace('{PROJECT_DIR}', rootPath))
        .map(x => vscode.Uri.file(x))
    }
    this.resourceChanged.fire()
  }

  suggestResource() {
    return this.resourcePaths.length > 0 ? this.resourcePaths[this.resourcePaths.length - 1] : null
  }
}
