import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import path from 'path'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig } from '@mse/types'

import { rootService } from '.'
import { BaseService } from './context'

export class InterfaceService extends BaseService {
  interfaceJson: Partial<Interface> = {}
  interfaceConfigJson: Partial<InterfaceConfig> = {}

  resourcePaths: vscode.Uri[] = []

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
    await this.loadInterfaceImpl()
    this.interfaceChanged.fire()
  }

  async loadInterfaceImpl() {
    this.interfaceJson = {}
    this.interfaceConfigJson = {}

    const root = rootService.activeResource
    if (!root) {
      return
    }

    const iDoc = await vscode.workspace.openTextDocument(root.interfaceUri)
    if (!iDoc) {
      return
    }
    this.interfaceJson = parse(iDoc.getText())

    const cDoc = await vscode.workspace.openTextDocument(root.configUri)
    if (!cDoc) {
      return
    }
    this.interfaceConfigJson = parse(cDoc.getText())
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
