import type { Node } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import { Bundle } from '../bundle/bundle'
import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import type { LayerInfo } from '../layer/layer'
import { type InterfaceInfo, parseInterface } from '../parser/interface/interface'

export class InterfaceBundle<T extends any> extends EventEmitter<{
  interfaceChanged: []
  activeChanged: []
  langChanged: []
  pathChanged: []
  bundleReloaded: []
}> {
  root: string
  file: string

  content: ContentJson<T>

  info?: InterfaceInfo

  active: string
  paths: string[]
  bundles: Bundle[]

  langFiles: [string, string][]
  langs: ContentJson<Record<string, string>>[]

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    root: string,
    file = 'interface.json'
  ) {
    super()

    this.root = root
    this.file = path.join(this.root, file)

    this.content = new ContentJson(loader, watcher, this.file, () => {
      if (this.content.node) {
        this.info = parseInterface(this.content.loader, this.content.node, this.file)
      } else {
        this.info = undefined
      }

      this.emit('interfaceChanged')
    })

    this.active = ''
    this.paths = []
    this.bundles = []

    this.langFiles = []
    this.langs = []

    this.on('interfaceChanged', () => {
      this.updatePaths()
      this.updateLangs()
    })

    this.on('activeChanged', () => {
      this.updatePaths()
    })

    this.on('langChanged', async () => {
      await Promise.all(this.langs.map(content => content.load()))
    })

    this.on('pathChanged', async () => {
      let prev: LayerInfo | undefined = undefined
      for (const bundle of this.bundles) {
        bundle.layer.parent = prev
        prev = bundle.layer
      }
      if (this.info) {
        this.info.layer.parent = prev
      }

      await Promise.all(this.bundles.map(bundle => bundle.load()))

      this.emit('bundleReloaded')
    })
  }

  async load() {
    await this.content.load()
  }

  stop() {
    this.content.stop()
    for (const bundle of this.bundles) {
      bundle.stop()
    }
  }

  async flush(flushBundles = false) {
    await this.content.flush()
    if (flushBundles) {
      await Promise.all(this.bundles.map(bundle => bundle.flush()))
    }
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
      for (const content of this.langs) {
        content.stop()
      }
      this.paths = resInfo.paths
      this.bundles = this.paths.map(dir => {
        return new Bundle(this.content.loader, this.content.watcher, path.join(this.root, dir))
      })
    } else {
      for (const bundle of this.bundles) {
        bundle.stop()
      }
      this.paths = []
      this.bundles = []
    }

    this.emit('pathChanged')
  }

  updateLangs() {
    const langInfos = this.info?.decls.filter(decl => decl.type === 'interface.language')
    if (langInfos) {
      const newFiles = langInfos.map(info => [info.name, info.path] as [string, string])
      if (JSON.stringify(this.langFiles) === JSON.stringify(newFiles)) {
        return // paths not changed
      }
      for (const content of this.langs) {
        content.stop()
      }
      this.langFiles = newFiles
      this.langs = newFiles.map(([locale, file]) => {
        return new ContentJson(
          this.content.loader,
          this.content.watcher,
          path.join(this.root, file),
          () => {}
        )
      })
    } else {
      for (const content of this.langs) {
        content.stop()
      }
      this.langFiles = []
      this.langs = []
    }

    this.emit('langChanged')
  }

  locateLayer(file: string): [layer: LayerInfo, relative: string] | null {
    if (file === this.file) {
      const layer = this.info?.layer
      return layer ? [layer, file] : null
    } else {
      for (const bundle of this.bundles) {
        if (file.startsWith(path.join(bundle.root, 'pipeline'))) {
          return [bundle.layer, path.relative(bundle.root, file)]
        }
      }
    }
    return null
  }
}
