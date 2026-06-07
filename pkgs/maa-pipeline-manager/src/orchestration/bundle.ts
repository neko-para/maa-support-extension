import EventEmitter from 'node:events'
import * as path from 'node:path'

import { parsePipelineContent } from '../io/load-pipeline'
import type { IContentLoader } from '../io/loader'
import type { IContentWatcher } from '../io/watch'
import { LayerInfo } from '../layer/layer'
import { type ParserConfig } from '../parser/utils'
import {
  type AbsolutePath,
  type ImageRelativePath,
  type RelativePath,
  joinPath
} from '../utils/types'
import { BundleManager } from './manager'

export class Bundle extends EventEmitter<{
  reset: []
  taskChanged: [tasks: string[]]
  imageChanged: []
}> {
  maa: boolean
  root: AbsolutePath
  parser?: ParserConfig

  pipelineRoot: AbsolutePath
  imageRoot: AbsolutePath

  files: Record<RelativePath, string>
  layer: LayerInfo

  manager: BundleManager

  imageChangedTimer?: NodeJS.Timeout

  get defaultPipelineRel() {
    return 'default_pipeline.json' as RelativePath
  }

  get defaultPipelinePath() {
    return joinPath(this.root, this.defaultPipelineRel)
  }

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    maa: boolean,
    root: string,
    parser?: ParserConfig
  ) {
    super()

    this.maa = maa
    this.root = root as AbsolutePath
    this.parser = parser

    this.pipelineRoot = joinPath(this.root, this.maa ? 'tasks' : 'pipeline')
    this.imageRoot = joinPath(this.root, this.maa ? 'template' : 'image')

    this.files = {}
    this.layer = new LayerInfo(loader, this.maa, this.root, 'resource')

    this.manager = new BundleManager(loader, watcher, this.root, this)
  }

  async load() {
    await this.manager.load()
  }

  stop() {
    this.manager.stop()
  }

  async flush() {
    await this.manager.flush()
  }

  filterFile(file: AbsolutePath, isdir: boolean): boolean {
    if (path.basename(file).startsWith('.')) {
      return false
    }
    if (isdir) {
      return (
        file.startsWith(this.pipelineRoot) || file.startsWith(this.imageRoot) || file === this.root
      )
    } else {
      if (file.startsWith(this.pipelineRoot)) {
        return file.endsWith('.json') || file.endsWith('.jsonc')
      } else if (file.startsWith(this.imageRoot)) {
        return file.endsWith('.png')
      } else if (file === this.defaultPipelinePath) {
        return true
      }
    }
    return false
  }

  needContent(file: AbsolutePath): boolean {
    return file.endsWith('.json') || file.endsWith('.jsonc')
  }

  async reset(): Promise<void> {
    this.files = {}
    this.layer.reset()
    this.emit('reset')
  }

  async loadFile(file: RelativePath, full: AbsolutePath, content?: string): Promise<void> {
    if (!this.filterFile(full, false)) {
      return
    }
    if (file.endsWith('.json') || file.endsWith('.jsonc')) {
      const changed = this.loadFileImpl(file, content)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      const imageFile = file
        .replaceAll(path.sep, '/')
        .replace(this.maa ? 'template/' : 'image/', '') as ImageRelativePath
      if (!this.layer.images.has(imageFile)) {
        this.layer.images.add(imageFile)
        this.dispatchImageChanged()
      }
    }
  }

  async deleteFile(file: RelativePath, full: AbsolutePath): Promise<void> {
    if (!this.filterFile(full, false)) {
      return
    }
    if (file.endsWith('.json') || file.endsWith('.jsonc')) {
      const changed = this.deleteFileImpl(file)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      const imageFile = file
        .replaceAll(path.sep, '/')
        .replace(this.maa ? 'template/' : 'image/', '') as ImageRelativePath
      if (this.layer.images.delete(imageFile)) {
        this.dispatchImageChanged()
      }
    }
  }

  loadFileImpl(file: RelativePath, content?: string): string[] {
    const isDefault = file === this.defaultPipelineRel

    const changed: string[] = []
    changed.push(...this.deleteFileImpl(file))
    if (!content) {
      return changed
    }

    this.files[file] = content
    const full = joinPath(this.root, file)

    const result = parsePipelineContent(content, full, this.maa, this.parser, isDefault)
    for (const entry of result.entries) {
      // parsePipelineContent 返回的是解析结果，但 LayerInfo 需要完整的 TaskInfo
      // 暂时保留原始 AST 节点构造，Phase 6 重构 LayerTaskInfo 后移除
      this.layer.mutableTaskInfo(entry.taskName).push({
        file: full,
        prop: undefined as never,
        data: undefined as never,
        info: undefined as never,
        obj: entry.obj
      })
      this.layer.markDirty()
      changed.push(entry.taskName)
    }
    for (const cfg of result.mpeConfigs) {
      this.layer.extraDecls.push(cfg)
    }
    return changed
  }

  deleteFileImpl(file: RelativePath): string[] {
    delete this.files[file]
    return this.layer.removeFile(joinPath(this.root, file))
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
