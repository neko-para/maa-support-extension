import EventEmitter from 'events'
import path from 'path'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig } from '@mse/types'
import { t, vscfs } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { PipelineRootStatusProvider } from './root'

export class PipelineProjectInterfaceProvider extends Service {
  interfaceJson: Interface | null
  interfaceConfigJson: InterfaceConfig | null
  currentResourceKey?: string

  event: EventEmitter<{
    activateResourceChanged: [resource: vscode.Uri[]]
    activateInterfaceChanged: []
  }>

  constructor() {
    super()

    this.interfaceJson = null
    this.interfaceConfigJson = null

    this.event = new EventEmitter()
  }

  get interfaceContent() {
    const root = this.shared(PipelineRootStatusProvider).activateResource.value
    if (!root) {
      return null
    }
    const doc = vscode.workspace.openTextDocument(root.interfaceUri)
    if (!doc) {
      return null
    }
    return doc.then(x => x.getText())
  }

  get interfaceConfigContent() {
    const root = this.shared(PipelineRootStatusProvider).activateResource.value
    if (!root) {
      return null
    }
    const doc = vscode.workspace.openTextDocument(root.configUri)
    if (!doc) {
      return null
    }
    return doc.then(x => x.getText())
  }

  async saveConfig(json?: string) {
    if (json === undefined) {
      return
    }
    const root = this.shared(PipelineRootStatusProvider).activateResource.value
    if (root) {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(path.dirname(root.configUri.fsPath))
      )
      await vscfs.writeFile(root.configUri, Buffer.from(json))
      this.interfaceConfigJson = JSON.parse(json)
    }
  }

  async loadInterface() {
    await this.loadInterfaceInner()
    this.event.emit('activateInterfaceChanged')
  }

  async loadInterfaceInner() {
    const root = this.shared(PipelineRootStatusProvider).activateResource

    this.interfaceJson = null
    this.interfaceConfigJson = null
    if (!root) {
      return
    }
    try {
      const json = await this.interfaceContent
      if (!json) {
        return
      }
      this.interfaceJson = JSON.parse(json)
    } catch (_) {
      return
    }
    try {
      let json = await this.interfaceConfigContent
      if (json) {
        this.interfaceConfigJson = JSON.parse(json)
        const newPaths = this.resourcePaths()
        const newPathsKey = newPaths.map(x => x.fsPath).join(',')
        if (newPathsKey !== this.currentResourceKey) {
          this.currentResourceKey = newPathsKey
          this.event.emit('activateResourceChanged', newPaths)
        }
      }
    } catch (_) {
      return
    }
  }

  async saveInterface() {
    const root = this.shared(PipelineRootStatusProvider).activateResource.value
    if (!root) {
      return
    }

    if (this.interfaceConfigJson) {
      const json = JSON.stringify(this.interfaceConfigJson, null, 4)
      await this.saveConfig(json)
    }
  }

  resourcePaths() {
    if (!this.interfaceJson || !this.interfaceConfigJson) {
      return []
    }
    const resInfo = this.interfaceJson.resource?.find(
      x => x.name === this.interfaceConfigJson?.resource
    )
    if (!resInfo) {
      vscode.window.showErrorMessage(
        t('maa.pi.error.cannot-find-resource', this.interfaceConfigJson?.resource ?? '<unknown>')
      )
      return []
    }
    const rootPath = this.shared(PipelineRootStatusProvider).activateResource.value?.dirUri?.fsPath
    if (!rootPath) {
      return []
    }
    return resInfo.path.map(x => x.replace('{PROJECT_DIR}', rootPath)).map(x => vscode.Uri.file(x))
  }

  suggestResource() {
    const res = this.resourcePaths()
    return res.length > 0 ? res[res.length - 1] : null
  }
}
