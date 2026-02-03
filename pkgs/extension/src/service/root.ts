import * as vscode from 'vscode'

import { AbsolutePath, RelativePath, relativePath } from '@mse/pipeline-manager'

import { stateService } from '.'
import { ResourceRoot, locateResourceRoot } from '../utils/fs'
import { BaseService } from './context'

export class RootService extends BaseService {
  resourceRoots: ResourceRoot[] = []
  activeResource: ResourceRoot | null = null

  refreshing: boolean = false

  refreshingChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onRefreshingChanged() {
    return this.refreshingChanged.event
  }

  activeResourceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onActiveResourceChanged() {
    return this.activeResourceChanged.event
  }

  constructor() {
    super()
    console.log('construct RootService')

    this.defer = this.activeResourceChanged
  }

  async init() {
    console.log('init RootService')

    this.refresh()
  }

  async refresh() {
    if (this.refreshing) {
      return
    }
    this.refreshing = true
    this.refreshingChanged.fire()

    const old = this.activeResource?.interfaceRelative ?? stateService.state.activeInterface ?? null
    const roots = await locateResourceRoot()
    if (roots.length > 0) {
      this.resourceRoots = roots
      this.activeResource = roots.find(res => res.interfaceRelative === old) ?? roots[0]
    } else {
      this.resourceRoots = []
      this.activeResource = null
    }

    stateService.reduce({
      activeInterface: this.activeResource?.interfaceRelative
    })
    this.activeResourceChanged.fire()
    this.refreshing = false
    this.refreshingChanged.fire()
  }

  select(index: number) {
    if (index < 0 || index >= this.resourceRoots.length) {
      this.activeResource = null
    } else {
      this.activeResource = this.resourceRoots[index]
    }
    stateService.reduce({
      activeInterface: this.activeResource?.interfaceRelative
    })
    this.activeResourceChanged.fire()
  }

  selectPath(path: string) {
    const index = this.resourceRoots.findIndex(info => info.interfaceRelative === path)
    this.select(index)
  }

  async revealConfig() {
    const config = this.activeResource?.configUri
    if (config) {
      try {
        const doc = await vscode.workspace.openTextDocument(config)
        vscode.window.showTextDocument(doc)
      } catch {}
    }
  }

  relativePathToRoot(uri: vscode.Uri, sub = '', root?: vscode.Uri) {
    if (this.activeResource) {
      if (!root) {
        root = this.activeResource.dirUri
      }
      if (sub) {
        root = vscode.Uri.joinPath(root, sub)
      }
      return uri.fsPath.replace(root.fsPath, '')
    } else {
      return uri.fsPath
    }
  }

  relativeToRoot(file: AbsolutePath): RelativePath {
    if (this.activeResource) {
      return relativePath(this.activeResource.dirUri.fsPath as AbsolutePath, file)
    } else {
      return file as string as RelativePath
    }
  }
}
