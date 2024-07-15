import EventEmitter from 'events'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { ResourceRoot, currentWorkspace, locateResourceRoot } from '../utils/fs'

export class PipelineRootStatusProvider extends Service {
  rootStatusItem: vscode.StatusBarItem
  resourceRoot: ResourceRoot[]
  activateResource: ResourceRoot | null
  selector: vscode.DocumentFilter[] | null

  event: EventEmitter<{
    activateRootChanged: []
    activateSelectorChanged: [selector: vscode.DocumentFilter[] | null]
  }>

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.defer = this.rootStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    )
    this.resourceRoot = []
    this.activateResource = null
    this.selector = null

    this.event = new EventEmitter()

    this.event.on('activateRootChanged', () => {
      this.updateRootStatus()
      this.updateSelector()
    })

    this.setupRootStatus()

    this.rootStatusItem.command = commands.SelectResource

    this.defer = vscode.commands.registerCommand(commands.SelectResource, async () => {
      const result = await vscode.window.showQuickPick(
        this.resourceRoot.map((x, index): vscode.QuickPickItem & { index: number } => ({
          label: x.dirRelative,
          detail: x.dirUri.fsPath,
          index
        }))
      )
      if (result) {
        this.activateResource = this.resourceRoot[result.index]
        this.event.emit('activateRootChanged')
      }
    })
  }

  async setupRootStatus() {
    this.resourceRoot = await locateResourceRoot()
    if (this.resourceRoot.length > 0) {
      this.activateResource = this.resourceRoot[0]
    } else {
      this.activateResource = null
    }
    this.event.emit('activateRootChanged')
  }

  updateRootStatus() {
    if (this.activateResource) {
      this.rootStatusItem.color = new vscode.ThemeColor('statusBarItem.background')
      this.rootStatusItem.text = 'Maa Support - ' + this.activateResource.dirRelative
    } else {
      this.rootStatusItem.color = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.rootStatusItem.text = 'Maa Support - No Root Found'
    }
    this.rootStatusItem.show()
  }

  jsonPattern() {
    return this.activateResource
      ? new vscode.RelativePattern(this.activateResource.dirUri, 'pipeline/**/*.json')
      : null
  }

  imagePattern() {
    return this.activateResource
      ? new vscode.RelativePattern(this.activateResource.dirUri, 'image/**/*.png')
      : null
  }

  updateSelector() {
    if (this.activateResource) {
      this.selector = [
        {
          language: 'json',
          scheme: 'file',
          pattern: this.jsonPattern()!
        }
      ]
    } else {
      this.selector = null
    }
    this.event.emit('activateSelectorChanged', this.selector)
  }

  relativePath(uri: vscode.Uri) {
    return uri.fsPath.replace(currentWorkspace()?.fsPath ?? '', '')
  }

  relativePathToRoot(uri: vscode.Uri, sub = '') {
    if (this.activateResource) {
      let rootUri = this.activateResource.dirUri
      if (sub) {
        rootUri = vscode.Uri.joinPath(rootUri, sub)
      }
      return uri.fsPath.replace(rootUri.fsPath, '')
    } else {
      return uri.fsPath
    }
  }
}
