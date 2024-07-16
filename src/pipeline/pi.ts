import EventEmitter from 'events'
import path from 'path'
import { config, emit } from 'process'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { Interface, InterfaceConfig } from '../projectInterface/type'
import { ResourceRoot } from '../utils/fs'
import { PipelineRootStatusProvider } from './root'

export class PipelineProjectInterfaceProvider extends Service {
  interfaceDoc: vscode.TextDocument | null
  interfaceConfigDoc: vscode.TextDocument | null
  interfaceJson: Interface | null
  interfaceConfigJson: InterfaceConfig | null

  event: EventEmitter<{
    interfaceChanged: []
    activateResourceChanged: [resource: vscode.Uri[]]
  }>

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.interfaceDoc = null
    this.interfaceConfigDoc = null
    this.interfaceJson = null
    this.interfaceConfigJson = null

    this.event = new EventEmitter()

    this.shared(PipelineRootStatusProvider).event.on('activateRootChanged', async () => {
      await this.loadInterface()
    })

    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === this.interfaceDoc?.uri.toString()) {
        try {
          this.interfaceJson = JSON.parse(this.interfaceDoc.getText())
          this.event.emit('interfaceChanged')
          this.event.emit('activateResourceChanged', this.resourcePaths())
        } catch (_) {
          return
        }
      } else if (e.document.uri.toString() === this.interfaceConfigDoc?.uri.toString()) {
        try {
          this.interfaceConfigJson = JSON.parse(this.interfaceConfigDoc.getText())
          this.event.emit('activateResourceChanged', this.resourcePaths())
        } catch (_) {
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
      this.interfaceJson = JSON.parse(this.interfaceDoc.getText())
      this.event.emit('interfaceChanged')
    } catch (_) {
      return
    }
    try {
      if (!this.interfaceConfigDoc) {
        await vscode.commands.executeCommand(commands.LaunchInterface)
      }
      if (this.interfaceConfigDoc) {
        this.interfaceConfigJson = JSON.parse(this.interfaceConfigDoc.getText())
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
      return []
    }
    const rootPath = this.shared(PipelineRootStatusProvider).activateResource?.dirUri?.fsPath
    if (!rootPath) {
      return []
    }
    return resInfo.path.map(x => x.replace('{PROJECT_DIR}', rootPath)).map(x => vscode.Uri.file(x))
  }
}
