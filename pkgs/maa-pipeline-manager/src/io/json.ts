import type { Node } from 'jsonc-parser'

import { buildTree, parseTreeWithoutParent } from '../utils/json'
import type { AbsolutePath } from '../utils/types'
import type { IContentLoader } from './loader'
import type { IContentWatcher, IContentWatcherController } from './watch'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ContentJson<T = any> {
  loader: IContentLoader
  watcher: IContentWatcher
  file: AbsolutePath
  changed: (node?: Node, obj?: T) => void | Promise<void>
  node?: Node
  object?: T

  private dirty = true
  private watcherCtrl?: IContentWatcherController
  private flushing = false
  private queued = false
  private timer?: ReturnType<typeof setTimeout>
  private flushComplete?: Promise<void>
  private flushResolve?: () => void

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    file: AbsolutePath,
    changed: (node?: Node, obj?: T) => void | Promise<void>
  ) {
    this.loader = loader
    this.watcher = watcher
    this.file = file
    this.changed = changed

    this.load()
  }

  async load() {
    this.watcherCtrl?.stop()
    this.dirty = true

    this.watcherCtrl = await this.watcher.watch(this.file, true, {
      filter: (_file, _isdir) => true,
      fileAdded: _file => {
        this.dirty = true
        this.dispatchFlush()
      },
      fileChanged: _file => {
        this.dirty = true
        this.dispatchFlush()
      },
      fileDeleted: _file => {
        this.dirty = true
        this.dispatchFlush()
      }
    })
    await this.flush()
  }

  stop() {
    this.watcherCtrl?.stop()
  }

  async flush() {
    if (this.flushing) {
      this.queued = true
      return this.flushComplete
    }
    this.flushing = true
    this.flushComplete = new Promise(resolve => {
      this.flushResolve = resolve
    })

    do {
      this.queued = false
      if (this.dirty) {
        const content = await this.loader.get(this.file)
        if (typeof content === 'string') {
          this.node = parseTreeWithoutParent(content)
        } else {
          this.node = undefined
        }
        if (this.node) {
          this.object = buildTree(this.node) as T
        } else {
          this.object = undefined
        }

        await this.changed(this.node, this.object)

        this.dirty = false
      }
    } while (this.queued)

    this.flushing = false
    this.flushResolve?.()
  }

  private dispatchFlush(timeout = 100) {
    if (this.timer) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.flush()
    }, timeout)
  }
}
