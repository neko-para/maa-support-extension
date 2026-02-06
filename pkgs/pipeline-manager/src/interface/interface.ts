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
import type { TaskDeclInfo } from '../parser/task/task'
import { isString, parseObject } from '../parser/utils'
import {
  type AbsolutePath,
  type RelativePath,
  type TaskName,
  joinPath,
  relativePath
} from '../utils/types'
import { LanguageBundle } from './language'

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
  switchActiveFinished: []
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

  activeController: string
  activeResource: string
  paths: RelativePath[]
  bundles: Bundle[]

  langBundle: LanguageBundle

  eval: MaaEvalDelegateImpl<T>

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

    this.activeController = ''
    this.activeResource = ''
    this.paths = []
    this.bundles = []

    this.langBundle = new LanguageBundle(loader, watcher, this.root)

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
      this.emit('switchActiveFinished')
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

    this.langBundle.on('localeChanged', () => {
      this.info.layer.extraDecls = this.langBundle.langs.map(lang => lang.decls).flat()

      this.emit('localeChanged')
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
    await this.langBundle.flush()
    if (flushBundles) {
      await Promise.all(this.bundles.map(bundle => bundle.flush()))
    }
  }

  switchActive(controller: string, resource: string) {
    this.activeController = controller
    this.activeResource = resource

    const pro = new Promise<void>(resolve => {
      this.once('switchActiveFinished', resolve)
    })

    this.emit('activeChanged')

    return pro
  }

  allControllerNames(onlyWithAttaches = false) {
    return this.info.decls
      .filter(decl => decl.type === 'interface.controller')
      .filter(onlyWithAttaches ? decl => decl.attachs.length > 0 : () => true)
      .map(info => info.name)
  }

  allResourceNames() {
    return this.info.decls.filter(decl => decl.type === 'interface.resource').map(info => info.name)
  }

  updatePaths() {
    const ctrlInfo = this.info.decls
      .filter(decl => decl.type === 'interface.controller')
      .find(info => info.name === this.activeController)
    const resInfo = this.info.decls
      .filter(decl => decl.type === 'interface.resource')
      .find(info => info.name === this.activeResource)

    const finalPaths: RelativePath[] = []
    if (resInfo) {
      finalPaths.push(...resInfo.paths)
    }
    if (ctrlInfo) {
      finalPaths.push(...ctrlInfo.attachs)
    }
    // 这里没去重, 主要是去重的定义不清晰; 之后看有说法再改

    if (finalPaths.length > 0) {
      if (JSON.stringify(this.paths) === JSON.stringify(finalPaths)) {
        this.emit('switchActiveFinished')
        return // paths not changed
      }
      for (const content of this.imports) {
        content.stop()
      }
      this.paths = finalPaths
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

    this.langBundle.update(newFiles).then(() => {
      this.emit('localeChanged')
    })
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
    if (
      file === this.file ||
      this.importFiles.includes(rel) ||
      this.langBundle.langs.find(lang => lang.file === rel)
    ) {
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
