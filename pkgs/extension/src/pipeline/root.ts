import EventEmitter from 'events'
import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { commands } from '../command'
import { Service } from '../data'
import { ResourceRoot, currentWorkspace, locateResourceRoot } from '../fs'

export class PipelineRootStatusProvider extends Service {
  resourceRoot: ResourceRoot[]
  activateResource: ResourceRoot | null
  selector: vscode.DocumentFilter[] | null

  constructor() {
    super()

    this.resourceRoot = []
    this.activateResource = null
    this.selector = null
  }

  async syncRootInfo(trySelect?: string) {
    const oldInterface = trySelect ?? this.activateResource?.interfaceRelative ?? null
    this.resourceRoot = await locateResourceRoot()
    if (this.resourceRoot.length > 0) {
      this.activateResource =
        this.resourceRoot.find(x => x.interfaceRelative === oldInterface) ?? this.resourceRoot[0]
    } else {
      this.activateResource = null
    }
  }

  selectRootInfo(index: number) {
    this.activateResource = this.resourceRoot[index]
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
