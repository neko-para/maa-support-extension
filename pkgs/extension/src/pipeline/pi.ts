import EventEmitter from 'events'
import { JSONParse, JSONStringify } from 'json-with-bigint'
import path from 'path'
import * as vscode from 'vscode'

import { t, vscfs } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { Interface, InterfaceConfig } from '../projectInterface/type'
import { PipelineRootStatusProvider } from './root'

export class PipelineProjectInterfaceProvider extends Service {
  interfaceJson: Interface | null
  interfaceConfigJson: InterfaceConfig | null

  event: EventEmitter<{
    interfaceChanged: []
    activateResourceChanged: [resource: vscode.Uri[]]
  }>

  constructor() {
    super()

    this.interfaceJson = null
    this.interfaceConfigJson = null

    this.event = new EventEmitter()
  }

  get interfaceContent() {
    const root = this.shared(PipelineRootStatusProvider).activateResource
    return root
      ? vscfs.readFile(root.interfaceUri).then(
          arr => arr.toString(),
          () => null
        )
      : null
  }

  get interfaceConfigContent() {
    const root = this.shared(PipelineRootStatusProvider).activateResource
    return root
      ? vscfs.readFile(root.configUri).then(
          arr => arr.toString(),
          () => null
        )
      : null
  }

  async saveConfig(json: string) {
    if (json === null) {
      return
    }
    const root = this.shared(PipelineRootStatusProvider).activateResource
    if (root) {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(path.dirname(root.configUri.fsPath))
      )
      await vscfs.writeFile(root.configUri, Buffer.from(json))
      this.interfaceJson = JSONParse(json)
    }
  }

  async loadInterface() {
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
      this.interfaceJson = JSONParse(json)
      this.event.emit('interfaceChanged')
    } catch (_) {
      return
    }
    try {
      let json = await this.interfaceConfigContent
      if (!json) {
        await vscode.commands.executeCommand(commands.LaunchInterface)
      }
      json = await this.interfaceConfigContent
      if (json) {
        this.interfaceConfigJson = JSONParse(json)
        this.event.emit('activateResourceChanged', this.resourcePaths())
      }
    } catch (_) {
      return
    }
  }

  async saveInterface() {
    const root = this.shared(PipelineRootStatusProvider).activateResource
    if (!root) {
      return
    }

    if (this.interfaceConfigJson) {
      const json = JSONStringify(this.interfaceConfigJson, 4)
      await this.saveConfig(json)
    }
  }

  resourcePaths() {
    if (!this.interfaceJson || !this.interfaceConfigJson) {
      return []
    }
    const resInfo = this.interfaceJson.resource.find(
      x => x.name === this.interfaceConfigJson?.resource
    )
    if (!resInfo) {
      vscode.window.showErrorMessage(
        t('maa.pi.error.cannot-find-resource', this.interfaceConfigJson?.resource ?? '<unknown>')
      )
      return []
    }
    const rootPath = this.shared(PipelineRootStatusProvider).activateResource?.dirUri?.fsPath
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
