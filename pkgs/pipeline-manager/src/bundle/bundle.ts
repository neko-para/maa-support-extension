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
import { BundleManager } from './manager'

export class Bundle extends EventEmitter<{
  reset: []
  taskChanged: [tasks: string[]]
  imageChanged: []
  defaultChanged: []
}> {
  root: string

  pipelineRoot: string
  imageRoot: string

  files: Record<string, string>
  layer: LayerInfo

  manager: BundleManager
  defaultPipeline: ContentJson<Record<'Default' | maa.RecognitionType | maa.ActionType, any>>

  imageChangedTimer?: NodeJS.Timeout

  constructor(loader: IContentLoader, watcher: IContentWatcher, root: string) {
    super()

    this.root = root

    this.pipelineRoot = path.join(this.root, 'pipeline')
    this.imageRoot = path.join(this.root, 'image')

    this.files = {}
    this.layer = new LayerInfo('resource')

    this.manager = new BundleManager(loader, watcher, root, this)
    this.defaultPipeline = new ContentJson(
      loader,
      watcher,
      path.join(this.root, 'default_pipeline.json'),
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
    this.layer = new LayerInfo('resource')
    this.emit('reset')
  }

  async loadFile(file: string, full: string, content?: string): Promise<void> {
    if (file.endsWith('.json')) {
      const changed = this.loadFileImpl(file, content)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      file = file.replaceAll(path.sep, '/').replace('image/', '')
      if (!this.layer.images.has(file)) {
        this.layer.images.add(file)
        this.dispatchImageChanged()
      }
    }
  }

  async deleteFile(file: string, full: string): Promise<void> {
    if (file.endsWith('.json')) {
      const changed = this.deleteFileImpl(file)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      if (this.layer.images.delete(file)) {
        this.dispatchImageChanged()
      }
    }
  }

  loadFileImpl(file: string, content?: string): string[] {
    const changed: string[] = []
    changed.push(...this.deleteFileImpl(file))
    if (!content) {
      return changed
    }

    this.files[file] = content

    const tree = parseTreeWithoutParent(content)
    if (tree && tree.type === 'object') {
      for (const [key, obj, prop] of parseObject(tree)) {
        if (key.startsWith('$')) {
          continue
        }

        this.layer.getTaskInfo(key).push({
          file,
          prop,
          data: obj,
          info: parseTask(obj)
        })
        changed.push(key)
      }
    }
    return changed
  }

  deleteFileImpl(file: string): string[] {
    const changed: string[] = []
    delete this.files[file]

    for (const [task, infos] of Object.entries(this.layer.tasks)) {
      const newInfos = infos.filter(info => info.file !== file)
      if (infos.length !== newInfos.length) {
        infos.splice(0, infos.length, ...newInfos)
        changed.push(task)
      }
    }
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
