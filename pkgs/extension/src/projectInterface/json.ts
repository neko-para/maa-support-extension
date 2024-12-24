import EventEmitter from 'events'
import path from 'path'
import { ComputedRef, Ref, computed, ref } from 'reactive-vscode'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig } from '@mse/types'
import { t, vscfs } from '@mse/utils'

import { Service } from '../data'
import { PipelineRootStatusProvider } from '../pipeline/root'

export class ProjectInterfaceJsonProvider extends Service {
  interfaceJson: Ref<Partial<Interface> | null>
  interfaceConfigJson: Ref<Partial<InterfaceConfig> | null>

  resourcePaths: ComputedRef<vscode.Uri[]>
  resourceKey: ComputedRef<string>

  event: EventEmitter<{
    interfaceChanged: []
  }>

  constructor() {
    super()

    this.interfaceJson = ref(null)
    this.interfaceConfigJson = ref(null)

    this.resourcePaths = computed(() => {
      if (!this.interfaceJson.value || !this.interfaceConfigJson.value) {
        return []
      }
      const resInfo = this.interfaceJson.value?.resource?.find(
        x => x.name === this.interfaceConfigJson.value?.resource
      )
      if (!resInfo) {
        return []
      }
      const rootPath = this.shared(PipelineRootStatusProvider).activateResource.value?.dirUri
        ?.fsPath
      if (!rootPath) {
        return []
      }
      return (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
        .map(x => x.replace('{PROJECT_DIR}', rootPath))
        .map(x => vscode.Uri.file(x))
    })
    this.resourceKey = computed(() => {
      return this.resourcePaths.value.map(x => x.fsPath).join(',')
    })

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
      this.interfaceConfigJson.value = JSON.parse(json)
      this.event.emit('interfaceChanged')
    }
  }

  async loadInterface() {
    await this.loadInterfaceInner()
    this.event.emit('interfaceChanged')
  }

  async loadInterfaceInner() {
    const root = this.shared(PipelineRootStatusProvider).activateResource

    if (!root) {
      return
    }
    try {
      const json = await this.interfaceContent
      if (!json) {
        return
      }
      this.interfaceJson.value = JSON.parse(json)
    } catch (_) {
      return
    }
    try {
      let json = await this.interfaceConfigContent
      if (json) {
        this.interfaceConfigJson.value = JSON.parse(json)
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

    if (this.interfaceConfigJson.value) {
      const json = JSON.stringify(this.interfaceConfigJson.value, null, 4)
      await this.saveConfig(json)
    }
  }

  suggestResource() {
    const res = this.resourcePaths.value
    return res.length > 0 ? res[res.length - 1] : null
  }
}
