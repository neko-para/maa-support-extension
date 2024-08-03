import EventEmitter from 'events'
import * as vscode from 'vscode'

import { commands } from '../command'
import { Service } from '../data'
import { t } from '../locale'
import { ResourceRoot, currentWorkspace, locateResourceRoot } from '../utils/fs'

export class PipelineRootStatusProvider extends Service {
  rootStatusItem: vscode.StatusBarItem
  resourceRoot: ResourceRoot[]
  activateResource: ResourceRoot | null
  selector: vscode.DocumentFilter[] | null

  event: EventEmitter<{
    activateRootChanged: []
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
    })

    this.syncRootInfo()

    this.rootStatusItem.command = commands.SelectResource
    this.rootStatusItem.tooltip = t('maa.pipeline.status.tooltip.click-select-interface')

    this.defer = vscode.commands.registerCommand(commands.SelectResource, async () => {
      await this.syncRootInfo()
      if (this.resourceRoot.length === 0) {
        await vscode.window.showErrorMessage(t('maa.pipeline.error.no-interface-found'))
        return
      }

      const result = await vscode.window.showQuickPick(
        this.resourceRoot.map((x, index): vscode.QuickPickItem & { index: number } => ({
          label: x.interfaceRelative,
          detail: x.interfaceUri.fsPath,
          index
        }))
      )
      if (result) {
        this.activateResource = this.resourceRoot[result.index]
        this.event.emit('activateRootChanged')
      }
    })
  }

  async syncRootInfo() {
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
      this.rootStatusItem.text = t(
        'maa.pipeline.status.using-interface',
        this.activateResource.interfaceRelative
      )
    } else {
      this.rootStatusItem.color = new vscode.ThemeColor('statusBarItem.errorBackground')
      this.rootStatusItem.text = t('maa.pipeline.status.no-interface-found')
    }
    this.rootStatusItem.show()
  }

  relativePath(uri: vscode.Uri) {
    return uri.fsPath.replace(currentWorkspace()?.fsPath ?? '', '')
  }

  relativePathToRoot(uri: vscode.Uri, sub = '', root?: vscode.Uri) {
    if (this.activateResource) {
      if (!root) {
        root = this.activateResource.dirUri
      }
      if (sub) {
        root = vscode.Uri.joinPath(root, sub)
      }
      return uri.fsPath.replace(root.fsPath, '')
    } else {
      return uri.fsPath
    }
  }
}
