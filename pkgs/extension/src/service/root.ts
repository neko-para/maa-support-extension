import * as vscode from 'vscode'

import { stateService } from '.'
import { ResourceRoot, locateResourceRoot } from '../fs'
import { BaseService } from './context'

export class RootService extends BaseService {
  resourceRoot: ResourceRoot[] = []
  activeResource: ResourceRoot | null = null

  activeResourceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onActiveResourceChanged() {
    return this.activeResourceChanged.event
  }

  async init() {
    this.defer = this.activeResourceChanged

    await this.refresh()
  }

  async refresh() {
    const old = this.activeResource?.interfaceRelative ?? stateService.state.activeInterface ?? null
    const roots = await locateResourceRoot()
    if (roots.length > 0) {
      this.resourceRoot = roots
      this.activeResource = roots.find(res => res.interfaceRelative === old) ?? roots[0]
    } else {
      this.resourceRoot = []
      this.activeResource = null
    }
    stateService.reduce({
      activeInterface: this.activeResource?.dirRelative
    })
    this.activeResourceChanged.fire()
  }
}
