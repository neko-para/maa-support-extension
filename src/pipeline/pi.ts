import EventEmitter from 'events'
import { config } from 'process'
import * as vscode from 'vscode'

import { Service } from '../data'
import { Interface, InterfaceConfig } from '../projectInterface/type'
import { ResourceRoot } from '../utils/fs'
import { PipelineRootStatusProvider } from './root'

export class PipelineProjectInterfaceProvider extends Service {
  interfaceJson: Interface | null
  interfaceConfigJson: InterfaceConfig | null

  event: EventEmitter<{
    activateResourceChanged: [resource: string[]]
  }>

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.interfaceJson = null
    this.interfaceConfigJson = null

    this.event = new EventEmitter()

    this.shared(PipelineRootStatusProvider).event.on('activateRootChanged', async () => {
      await this.loadInterface(this.shared(PipelineRootStatusProvider).activateResource)
      this.event.emit('activateResourceChanged', this.resourcePaths())
    })
  }

  async loadInterface(root: ResourceRoot | null) {
    this.interfaceJson = null
    this.interfaceConfigJson = null
    if (!root) {
      return
    }
    try {
      this.interfaceJson = JSON.parse(
        Buffer.from(await vscode.workspace.fs.readFile(root.interfaceUri)).toString()
      )
    } catch (_) {
      await vscode.window.showErrorMessage(vscode.l10n.t('maa.pi.error.load-interface-failed'))
      return
    }
    try {
      this.interfaceConfigJson = JSON.parse(
        Buffer.from(await vscode.workspace.fs.readFile(root.configUri)).toString()
      )
    } catch (_) {
      return
    }
  }

  async saveInterface(root: ResourceRoot) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root.dirUri, 'config'))
    if (this.interfaceConfigJson) {
      const data = JSON.stringify(
        this.interfaceConfigJson,
        (key, value) => {
          if (key === 'hwnd') {
            return undefined
          }
          return value
        },
        4
      )
      await vscode.workspace.fs.writeFile(root.configUri, Buffer.from(data, 'utf8'))
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
      return []
    }
    const rootPath = this.shared(PipelineRootStatusProvider).activateResource?.dirUri?.fsPath
    if (!rootPath) {
      return []
    }
    return resInfo.path.map(x => x.replace('{PROJECT_DIR}', rootPath))
  }
}
