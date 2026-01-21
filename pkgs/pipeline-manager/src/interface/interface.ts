import type { Node } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import { Bundle } from '../bundle/bundle'
import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import type { LayerInfo } from '../layer/layer'
import { type InterfaceInfo, parseInterface } from '../parser/interface/interface'
import { type AbsolutePath, type RelativePath, joinPath, relativePath } from '../utils/types'

export class InterfaceBundle<T extends any> extends EventEmitter<{
  interfaceChanged: []
  activeChanged: []
  langChanged: []
  pathChanged: []
  bundleReloaded: []
  pipelineChanged: []
}> {
  maa: boolean
  root: AbsolutePath
  file: AbsolutePath

  content: ContentJson<T>

  info?: InterfaceInfo

  active: string
  paths: RelativePath[]
  bundles: Bundle[]

  langFiles: [string, RelativePath][]
  langs: ContentJson<Record<string, string>>[]

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    maa: boolean,
    root: string,
    file = 'interface.json'
  ) {
    super()

    this.maa = maa
    this.root = root as AbsolutePath
    this.file = joinPath(this.root, file)

    this.content = new ContentJson(loader, watcher, this.file, () => {
      if (this.content.node) {
        this.info = parseInterface(this.content.loader, this.content.node, {
          maa: this.maa,
          file: this.file
        })
        if (this.bundles.length > 0) {
          this.info.layer = this.bundles[this.bundles.length - 1].layer
        }
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

    this.on('bundleReloaded', () => {
      for (const bundle of this.bundles) {
        bundle.on('reset', () => {
          this.emit('pipelineChanged')
        })
        bundle.on('taskChanged', () => {
          this.emit('pipelineChanged')
        })
        bundle.on('imageChanged', () => {
          this.emit('pipelineChanged')
        })
        bundle.on('defaultChanged', () => {
          this.emit('pipelineChanged')
        })
      }
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
        return new Bundle(
          this.content.loader,
          this.content.watcher,
          this.maa,
          path.join(this.root, dir)
        )
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
      const newFiles = langInfos.map(info => [info.name, info.path] as [string, RelativePath])
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
          joinPath(this.root, file),
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

  locateLayer(file: AbsolutePath): [layer: LayerInfo, absolute: AbsolutePath] | null {
    if (file === this.file) {
      const layer = this.info?.layer
      return layer ? [layer, file] : null
    } else {
      for (const bundle of this.bundles) {
        if (file.startsWith(joinPath(bundle.root, this.maa ? 'tasks' : 'pipeline'))) {
          return [bundle.layer, file]
        }
      }
    }
    return null
  }

  get allLayers() {
    const layers = this.bundles.map(bundle => bundle.layer)
    if (this.info?.layer) {
      layers.push(this.info.layer)
    }
    return layers
  }

  get topLayer() {
    if (this.info?.layer) {
      return this.info.layer
    }
    if (this.bundles.length > 0) {
      return this.bundles[this.bundles.length - 1].layer
    }
    return null
  }
}
