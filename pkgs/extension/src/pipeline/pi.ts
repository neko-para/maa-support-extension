import EventEmitter from 'events'
import { JSONParse, JSONStringify } from 'json-with-bigint'
import path from 'path'
import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { Interface, InterfaceConfig } from '../projectInterface/type'
import { PipelineRootStatusProvider } from './root'

export class PipelineProjectInterfaceProvider extends Service {
  configStatusItem: vscode.StatusBarItem
  interfaceDoc: vscode.TextDocument | null
  interfaceConfigDoc: vscode.TextDocument | null
  interfaceJson: Interface | null
  interfaceConfigJson: InterfaceConfig | null

  event: EventEmitter<{
    interfaceChanged: []
    activateResourceChanged: [resource: vscode.Uri[]]
  }>

  constructor() {
    super()

    this.defer = this.configStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    )
    this.interfaceDoc = null
    this.interfaceConfigDoc = null
    this.interfaceJson = null
    this.interfaceConfigJson = null

    this.event = new EventEmitter()

    this.configStatusItem.command = commands.LaunchInterface
    this.configStatusItem.tooltip = t('maa.pipeline.status.tooltip.click-launch-interface')

    this.shared(PipelineRootStatusProvider).event.on('activateRootChanged', async () => {
      await this.loadInterface()
      this.updateConfigStatus()
    })

    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === this.interfaceDoc?.uri.toString()) {
        try {
          this.interfaceJson = JSONParse(this.interfaceDoc.getText())
          this.updateConfigStatus()
          this.event.emit('interfaceChanged')
          this.event.emit('activateResourceChanged', this.resourcePaths())
        } catch (_) {
          this.updateConfigStatus()
          return
        }
      } else if (e.document.uri.toString() === this.interfaceConfigDoc?.uri.toString()) {
        try {
          this.interfaceConfigJson = JSONParse(this.interfaceConfigDoc.getText())
          this.updateConfigStatus()
          this.event.emit('activateResourceChanged', this.resourcePaths())
        } catch (_) {
          this.updateConfigStatus()
          return
        }
      }
    })
  }

  async loadInterface() {
    const root = this.shared(PipelineRootStatusProvider).activateResource

    this.interfaceDoc = null
    this.interfaceConfigDoc = null
    this.interfaceJson = null
    this.interfaceConfigJson = null
    if (!root) {
      return
    }
    this.interfaceDoc = await vscode.workspace.openTextDocument(root.interfaceUri)
    try {
      this.interfaceConfigDoc = await vscode.workspace.openTextDocument(root.configUri)
    } catch (_) {}
    if (!this.interfaceDoc) {
      return
    }
    try {
      this.interfaceJson = JSONParse(this.interfaceDoc.getText())
      this.event.emit('interfaceChanged')
    } catch (_) {
      return
    }
    try {
      if (!this.interfaceConfigDoc) {
        await vscode.commands.executeCommand(commands.LaunchInterface)
      }
      if (this.interfaceConfigDoc) {
        this.interfaceConfigJson = JSONParse(this.interfaceConfigDoc.getText())
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
      const data = JSONStringify(this.interfaceConfigJson, 4)
      if (this.interfaceConfigDoc) {
        const edit = new vscode.WorkspaceEdit()
        const lastLine = this.interfaceConfigDoc.lineAt(this.interfaceConfigDoc.lineCount - 1)
        edit.replace(
          this.interfaceConfigDoc.uri,
          new vscode.Range(new vscode.Position(0, 0), lastLine.range.end),
          data
        )
        vscode.workspace.applyEdit(edit)
        await this.interfaceConfigDoc.save()
      } else {
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.file(path.dirname(root.configUri.fsPath))
        )
        await vscode.workspace.fs.writeFile(root.configUri, Buffer.from(data))
        this.interfaceConfigDoc = await vscode.workspace.openTextDocument(root.configUri)
      }
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

  updateConfigStatus() {
    if (!this.shared(PipelineRootStatusProvider).activateResource) {
      this.configStatusItem.hide()
      return
    }
    if (!this.interfaceJson) {
      this.configStatusItem.color = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.configStatusItem.text = t('maa.pipeline.status.load-interface-failed')
    } else if (!this.interfaceConfigJson) {
      this.configStatusItem.color = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.configStatusItem.text = t('maa.pipeline.status.interface-not-configured')
    } else {
      this.configStatusItem.color = new vscode.ThemeColor('statusBarItem.background')
      this.configStatusItem.text = t('maa.pipeline.status.interface-configured')
    }
    this.configStatusItem.show()
  }
}
