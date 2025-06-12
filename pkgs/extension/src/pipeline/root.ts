import { ShallowRef, shallowRef } from 'reactive-vscode'
import * as vscode from 'vscode'

import { Service } from '../data'
import { ResourceRoot, currentWorkspace, locateResourceRoot } from '../fs'

export class PipelineRootStatusProvider extends Service {
  resourceRoot: ResourceRoot[]
  activateResource: ShallowRef<ResourceRoot | null>

  constructor() {
    super()

    this.resourceRoot = []
    this.activateResource = shallowRef(null)
  }

  async syncRootInfo(trySelect?: string) {
    const oldInterface = trySelect ?? this.activateResource.value?.interfaceRelative ?? null
    this.resourceRoot = await locateResourceRoot()
    if (this.resourceRoot.length > 0) {
      this.activateResource.value =
        this.resourceRoot.find(x => x.interfaceRelative === oldInterface) ?? this.resourceRoot[0]
    } else {
      this.activateResource.value = null
    }
  }

  selectRootInfo(index: number) {
    this.activateResource.value = this.resourceRoot[index]
  }

  relativePath(uri: vscode.Uri) {
    return uri.fsPath.replace(currentWorkspace()?.fsPath ?? '', '')
  }

  relativePathToRoot(uri: vscode.Uri, sub = '', root?: vscode.Uri) {
    if (this.activateResource.value) {
      if (!root) {
        root = this.activateResource.value.dirUri
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
