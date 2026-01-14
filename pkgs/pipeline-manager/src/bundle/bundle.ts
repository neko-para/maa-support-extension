import { type Node, parseTree } from 'jsonc-parser'
import EventEmitter from 'node:events'
import * as path from 'node:path'

import type { IContentLoader } from './loader'
import { ContentManager } from './manager'
import type { IContentWatcher } from './watch'

const defaultPipelineFile = 'default_pipeline.json'

function shrinkParent(node: Node) {
  type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> }
  delete (node as DeepWriteable<Node>).parent
  for (const child of node.children ?? []) {
    shrinkParent(child)
  }
}

export type TaskInfo = {
  file: string
  content: string
  node: Node
}

export class Bundle extends EventEmitter<{
  reset: []
  taskChanged: [tasks: string[]]
  imageChanged: []
}> {
  root: string

  defaultPipelinePath: string
  pipelineRoot: string
  imageRoot: string

  files: Record<string, string>
  tasks: Record<string, TaskInfo[]>
  images: Set<string>

  content: ContentManager

  imageChangedTimer?: NodeJS.Timeout

  constructor(loader: IContentLoader, watcher: IContentWatcher, root: string) {
    super()

    this.root = root

    this.defaultPipelinePath = path.join(this.root, defaultPipelineFile)
    this.pipelineRoot = path.join(this.root, 'pipeline')
    this.imageRoot = path.join(this.root, 'image')

    this.files = {}
    this.tasks = {}
    this.images = new Set()

    this.content = new ContentManager(loader, watcher, root, this)
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
      if (file === this.defaultPipelinePath) {
        return true
      } else if (file.startsWith(this.pipelineRoot)) {
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
    this.tasks = {}
    this.images = new Set()
    this.emit('reset')
  }

  async loadFile(file: string, full: string, content?: string): Promise<void> {
    if (file.endsWith('.json')) {
      const changed = this.loadFileImpl(file, content)
      if (changed.length > 0) {
        this.emit('taskChanged', [...new Set(changed)])
      }
    } else if (file.endsWith('.png')) {
      if (!this.images.has(file)) {
        this.images.add(file)
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
      if (this.images.delete(file)) {
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

    if (file === defaultPipelineFile) {
      return changed
    }

    const tree = parseTree(content)
    if (tree && tree.type === 'object') {
      shrinkParent(tree)
      for (const node of tree.children ?? []) {
        if (node.type !== 'property' || !node.children || node.children.length !== 2) {
          continue
        }
        const [prop, obj] = node.children
        if (prop.type !== 'string' || obj.type !== 'object') {
          continue
        }
        if (typeof prop.value !== 'string' || prop.value.startsWith('$')) {
          continue
        }
        this.tasks[prop.value] = this.tasks[prop.value] ?? []
        this.tasks[prop.value].push({
          file,
          content: content.slice(obj.offset, obj.length),
          node
        })
        changed.push(prop.value)
      }
    }
    return changed
  }

  deleteFileImpl(file: string): string[] {
    const changed: string[] = []
    delete this.files[file]

    for (const [task, infos] of Object.entries(this.tasks)) {
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
