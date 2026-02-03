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
import { LayerInfo } from '../layer/layer'
import {
  type InterfaceInfo,
  type InterfaceRefInfo,
  parseInterface
} from '../parser/interface/interface'
import { isString, parseObject } from '../parser/utils'
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
  importChanged: []
  slaveInterfaceChanged: []
  activeChanged: []
  langChanged: []
  localeChanged: []
  pathChanged: []
  bundleReloaded: []
  pipelineChanged: []
}> {
  maa: boolean
  root: AbsolutePath
  file: AbsolutePath

  content: ContentJson<T>

  info: InterfaceInfo

  importFiles: RelativePath[]
  imports: ContentJson<T>[]

  active: string
  paths: RelativePath[]
  bundles: Bundle[]

  langFiles: [string, RelativePath][]
  langs: ContentJson<Record<string, string>>[]
  langIndex: Record<
    string,
    {
      location: Node
      locale: string
      localeIndex: number
      prop: Node
      value: string
    }[]
  >

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
    file = 'interface.json'
  ) {
    super()

    this.maa = maa
    this.root = root as AbsolutePath
    this.file = joinPath(this.root, file)

    this.content = new ContentJson(loader, watcher, this.file, () => {
      this.removeFile(this.file)

      if (this.content.node) {
        parseInterface(this.content.node, this.info, {
          maa: this.maa,
          file: this.file,
          import: false
        })
      }

      this.emit('interfaceChanged')
    })

    this.info = {
      decls: [],
      refs: [],
      layer: new LayerInfo(loader, this.maa, this.root, 'interface')
    }

    this.active = ''
    this.paths = []
    this.bundles = []

    this.langFiles = []
    this.langs = []
    this.langIndex = {}

    this.importFiles = []
    this.imports = []

    this.eval = new MaaEvalDelegateImpl(this)

    this.on('interfaceChanged', () => {
      this.updatePaths()
      this.updateLangs()
      this.updateImports()
    })

    this.on('activeChanged', () => {
      this.updatePaths()
    })

    this.on('langChanged', async () => {
      await Promise.all(this.langs.map(content => content.load()))
    })

    this.on('importChanged', async () => {
      await Promise.all(this.imports.map(content => content.load()))
    })

    this.on('pathChanged', async () => {
      let prev: LayerInfo | undefined = undefined
      for (const bundle of this.bundles) {
        bundle.layer.parent = prev
        prev = bundle.layer
      }
      this.info.layer.parent = prev

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
    for (const imp of this.imports) {
      await imp.flush()
    }
    if (flushBundles) {
      await Promise.all(this.bundles.map(bundle => bundle.flush()))
    }
  }

  switchActive(active: string) {
    this.active = active

    this.emit('activeChanged')
  }

  allResourceNames() {
    return this.info.decls.filter(decl => decl.type === 'interface.resource').map(info => info.name)
  }

  updatePaths() {
    const resInfo = this.info.decls
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
    const langInfos = this.info.decls.filter(decl => decl.type === 'interface.language')

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
        () => {
          this.buildLangIndex()
        }
      )
    })

    this.emit('langChanged')
  }

  buildLangIndex() {
    this.langIndex = {}
    for (const [index, [locale]] of this.langFiles.entries()) {
      const lang = this.langs[index]
      for (const [key, obj, prop] of parseObject(lang.node)) {
        if (!isString(obj)) {
          continue
        }
        this.langIndex[key] = this.langIndex[key] ?? []
        this.langIndex[key].push({
          location: obj,
          locale,
          localeIndex: index,
          prop,
          value: obj.value
        })
      }
    }

    this.emit('localeChanged')
  }

  sortLocaleRef() {
    const refs = this.info.refs.filter(ref => ref.type === 'interface.locale')
    const allImports = this.importFiles.map(rel => {
      return path.resolve(joinPath(this.root, rel)) as AbsolutePath
    })
    allImports.unshift(this.file)
    refs.sort((a, b) => {
      if (a.file !== b.file) {
        if (a.file === this.file) {
          return -1
        } else if (b.file === this.file) {
          return 1
        } else {
          const idxA = allImports.indexOf(a.file)
          const idxB = allImports.indexOf(b.file)
          return idxA - idxB
        }
      } else {
        return a.location.offset - b.location.offset
      }
    })
    const exists = new Set<string>()
    const final: (typeof refs)[number][] = []
    for (const ref of refs) {
      if (!exists.has(ref.target)) {
        final.push(ref)
        exists.add(ref.target)
      }
    }
    return final
  }

  findEmplaceLocation(
    refs: (InterfaceRefInfo & { type: 'interface.locale' })[],
    file: AbsolutePath,
    offset: number
  ) {
    const allImports = this.importFiles.map(rel => {
      return path.resolve(joinPath(this.root, rel)) as AbsolutePath
    })
    allImports.unshift(this.file)
    const idx = allImports.indexOf(file)
    if (idx === -1) {
      return refs.length
    }
    const result = refs.findIndex(ref => {
      if (ref.file === file) {
        return ref.location.offset > offset
      } else {
        const idxR = allImports.indexOf(ref.file)
        return idx < idxR
      }
    })
    return result === -1 ? refs.length : result
  }

  removeFile(file: AbsolutePath) {
    this.info.decls = this.info.decls.filter(decl => decl.file !== file)
    this.info.refs = this.info.refs.filter(ref => ref.file !== file)
    this.info.layer.removeFile(file)
  }

  updateImports() {
    const importInfos = this.info.refs.filter(ref => ref.type === 'interface.import_path')

    const newFiles = importInfos.map(info => info.target)
    if (JSON.stringify(this.importFiles) === JSON.stringify(newFiles)) {
      return // paths not changed
    }
    this.info.decls = this.info.decls.filter(decl => decl.file === this.file)
    this.info.refs = this.info.refs.filter(ref => ref.file === this.file)
    for (const content of this.imports) {
      content.stop()
      this.info.layer.removeFile(content.file)
    }
    this.importFiles = newFiles
    this.imports = newFiles.map(file => {
      const full = joinPath(this.root, file)
      return new ContentJson(this.content.loader, this.content.watcher, full, node => {
        this.removeFile(full)
        if (node) {
          parseInterface(node, this.info, {
            maa: this.maa,
            file: full,
            import: true
          })
        }
        this.emit('slaveInterfaceChanged')
      })
    })

    this.emit('importChanged')
  }

  locateLayer(
    file: AbsolutePath
  ): [layer: LayerInfo, absolute: AbsolutePath, isDefault: boolean] | null {
    const rel = relativePath(this.root, file).replaceAll(path.sep, '/') as RelativePath
    if (file === this.file || this.importFiles.includes(rel)) {
      return [this.info.layer, file, false]
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
    layers.push(this.info.layer)
    return layers
  }

  get topLayer() {
    return this.info.layer
  }

  evalTask(task: string): Partial<Record<keyof maa.Task, unknown>> {
    return this.topLayer.evalTask(task as TaskName)
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
