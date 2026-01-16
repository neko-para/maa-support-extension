import type { Node } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import { Bundle } from '../bundle/bundle'
import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import { type InterfaceInfo, parseInterface } from '../parser/interface/interface'

export class Interface extends EventEmitter<{
  interfaceChanged: []
  activeChanged: []
  pathChanged: []
  bundleReloaded: []
}> {
  root: string

  content: ContentJson

  info?: InterfaceInfo

  active: string
  paths: string[]
  bundles: Bundle[]

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    root: string,
    file = 'interface.json'
  ) {
    super()

    this.root = root

    this.content = new ContentJson(loader, watcher, path.join(this.root, file), () => {
      if (this.content.node) {
        this.info = parseInterface(this.content.node)
      } else {
        this.info = undefined
      }

      this.emit('interfaceChanged')
    })

    this.active = ''
    this.paths = []
    this.bundles = []

    this.on('interfaceChanged', () => {
      this.updatePaths()
    })

    this.on('activeChanged', () => {
      this.updatePaths()
    })

    this.on('pathChanged', async () => {
      await Promise.all(this.bundles.map(bundle => bundle.load()))

      this.emit('bundleReloaded')
    })
  }

  async load() {
    await this.content.load()
  }

  async flush() {
    await this.content.flush()
  }

  switchActive(active: string) {
    this.active = active

    this.emit('activeChanged')
  }

  updatePaths() {
    const resInfo = this.info?.decls
      .filter(decl => decl.type === 'interface.resource')
      .find(info => info.name === this.active)
    if (resInfo) {
      if (JSON.stringify(this.paths) === JSON.stringify(resInfo.paths)) {
        return // paths not changed
      }
      this.paths = resInfo.paths
      this.bundles = this.paths.map(dir => {
        return new Bundle(this.content.loader, this.content.watcher, dir)
      })
    } else {
      this.paths = []
      this.bundles = []
    }

    this.emit('pathChanged')
  }
}
