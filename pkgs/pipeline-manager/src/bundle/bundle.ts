import type { Node } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import { LayerInfo } from '../layer/layer'
import { parseTask } from '../parser/task/task'
import { parseObject } from '../parser/utils'
import { parseTreeWithoutParent } from '../utils/json'
import {
  type AbsolutePath,
  type ImageRelativePath,
  type RelativePath,
  type TaskName,
  joinPath
} from '../utils/types'
import { BundleManager } from './manager'

export class Bundle extends EventEmitter<{
  reset: []
  taskChanged: [tasks: string[]]
  imageChanged: []
  defaultChanged: []
}> {
  maa: boolean
  root: AbsolutePath

  pipelineRoot: AbsolutePath
  imageRoot: AbsolutePath

  files: Record<RelativePath, string>
  layer: LayerInfo

  manager: BundleManager
  defaultPipeline: ContentJson<Record<'Default' | maa.RecognitionType | maa.ActionType, any>>

  imageChangedTimer?: NodeJS.Timeout

  constructor(loader: IContentLoader, watcher: IContentWatcher, maa: boolean, root: string) {
    super()

    this.maa = maa
    this.root = root as AbsolutePath

    this.pipelineRoot = joinPath(this.root, 'pipeline')
    this.imageRoot = joinPath(this.root, 'image')

    this.files = {}
    this.layer = new LayerInfo(loader, this.root, 'resource')

    this.manager = new BundleManager(loader, watcher, this.root, this)
    this.defaultPipeline = new ContentJson(
      loader,
      watcher,
      joinPath(this.root, 'default_pipeline.json'),
      () => {
        this.emit('defaultChanged')
      }
    )
  }

  async load() {
    await Promise.all([this.manager.load(), this.defaultPipeline.load()])
  }

  stop() {
    this.manager.stop()
    this.defaultPipeline.stop()
  }

  async flush() {
    await Promise.all([this.manager.flush(), this.defaultPipeline.flush()])
  }

  filterFile(file: string, isdir: boolean): boolean {
    if (path.basename(file).startsWith('.')) {
      return false
    }
    if (isdir) {
      return (
        file.startsWith(this.pipelineRoot) || file.startsWith(this.imageRoot) || file === this.root
      )
    } else {
      if (file.startsWith(this.pipelineRoot)) {
        return file.endsWith('.json')
      } else if (file.startsWith(this.imageRoot)) {
        return file.endsWith('.png')
      }
    }
    return false
  }

  needContent(file: string): boolean {
    return file.endsWith('.json')
  }

  async reset(): Promise<void> {
    this.files = {}
    this.layer.reset()
    this.emit('reset')
  }

  async loadFile(file: RelativePath, full: AbsolutePath, content?: string): Promise<void> {
    if (file.endsWith('.json')) {
      const changed = this.loadFileImpl(file, content)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      const imageFile = file.replaceAll(path.sep, '/').replace('image/', '') as ImageRelativePath
      if (!this.layer.images.has(imageFile)) {
        this.layer.images.add(imageFile)
        this.dispatchImageChanged()
      }
    }
  }

  async deleteFile(file: RelativePath, full: AbsolutePath): Promise<void> {
    if (file.endsWith('.json')) {
      const changed = this.deleteFileImpl(file)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      const imageFile = file.replaceAll(path.sep, '/').replace('image/', '') as ImageRelativePath
      if (this.layer.images.delete(imageFile)) {
        this.dispatchImageChanged()
      }
    }
  }

  loadFileImpl(file: RelativePath, content?: string): string[] {
    const changed: string[] = []
    changed.push(...this.deleteFileImpl(file))
    if (!content) {
      return changed
    }

    this.files[file] = content
    const full = joinPath(this.root, file)

    const tree = parseTreeWithoutParent(content)
    if (tree && tree.type === 'object') {
      for (const [key, obj, prop] of parseObject(tree)) {
        if (key.startsWith('$')) {
          continue
        }

        this.layer.mutableTaskInfo(key as TaskName).push({
          file: full,
          prop,
          data: obj,
          info: parseTask(obj, {
            maa: this.maa,
            file: full,
            task: prop
          })
        })
        this.layer.markDirty()
        changed.push(key)
      }
    }
    return changed
  }

  deleteFileImpl(file: RelativePath): string[] {
    const changed: string[] = []
    delete this.files[file]

    for (const [task, infos] of Object.entries(this.layer.tasks)) {
      const newInfos = infos.filter(info => info.file !== joinPath(this.root, file))
      if (infos.length !== newInfos.length) {
        infos.splice(0, infos.length, ...newInfos)
        changed.push(task)
      }
    }
    this.layer.markDirty()
    return changed
  }

  dispatchImageChanged() {
    if (this.imageChangedTimer) {
      clearTimeout(this.imageChangedTimer)
    }
    this.imageChangedTimer = setTimeout(() => {
      this.emit('imageChanged')
    }, 100)
  }
}
