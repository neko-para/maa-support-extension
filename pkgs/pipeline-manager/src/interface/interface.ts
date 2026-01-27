import type { Node } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import {
  MaaErrorDelegate,
  MaaEvalContext,
  MaaEvalDelegate,
  type MaaTask,
  type MaaTaskExpr,
  type MaaTaskWithTraceInfo
} from '@nekosu/maa-tasker'

import { Bundle } from '../bundle/bundle'
import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import type { LayerInfo } from '../layer/layer'
import { type InterfaceInfo, parseInterface } from '../parser/interface/interface'
import {
  type AbsolutePath,
  type RelativePath,
  type TaskName,
  joinPath,
  relativePath
} from '../utils/types'

class MaaEvalDelegateImpl<T extends any> extends MaaEvalDelegate {
  intBundle: InterfaceBundle<T>

  constructor(intBundle: InterfaceBundle<T>) {
    super(new MaaErrorDelegate())

    this.intBundle = intBundle
  }

  query(task: string): [task: MaaTask, anchor: string][] {
    const topLayer = this.intBundle.topLayer
    if (!topLayer) {
      return []
    }

    const infos = topLayer.getTask(task as TaskName, false)
    infos.reverse() // 内部需要从底层到上层
    return infos.map(({ layer, infos }) => {
      const info = infos[0]
      // 这里硬编码了下逻辑
      const match = /resource\/global\/(.+)\//.exec(layer.root)
      const anchor = match ? match[1] : 'Official'
      return [info.obj as MaaTask, anchor]
    })
  }
}

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

  eval: MaaEvalDelegateImpl<T>

  contentDebouncerTimer?: NodeJS.Timeout

  set evalErrorDelegate(delegate: MaaErrorDelegate) {
    this.eval.error = delegate
  }

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    maa: boolean,
    root: string,
    file = 'interface.json',
    debounce = 500
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

    this.eval = new MaaEvalDelegateImpl(this)

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

  locateLayer(
    file: AbsolutePath
  ): [layer: LayerInfo, absolute: AbsolutePath, isDefault: boolean] | null {
    if (file === this.file) {
      const layer = this.info?.layer
      return layer ? [layer, file, false] : null
    } else {
      for (const bundle of this.bundles) {
        if (file.startsWith(joinPath(bundle.root, this.maa ? 'tasks' : 'pipeline'))) {
          return [bundle.layer, file, false]
        }
        if (file === bundle.defaultPipelinePath) {
          return [bundle.layer, file, true]
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

  evalTask(task: string): Partial<Record<keyof maa.Task, unknown>> | null {
    return this.topLayer?.evalTask(task as TaskName) ?? null
  }

  maaEvalTask(task: string): MaaTaskWithTraceInfo<MaaTask> | null {
    if (!this.maa) {
      return null
    }

    const context = new MaaEvalContext(this.eval)

    const result = context.evalTask(task)
    if (result) {
      delete (result.task as MaaTask).__baseTaskResolved
    }
    return result
  }

  maaEvalExpr(expr: MaaTaskExpr, self: string, strip: boolean): string[] | null {
    if (!this.maa) {
      return null
    }

    const context = new MaaEvalContext(this.eval)

    return context.evalExpr(expr, self, strip)
  }
}
