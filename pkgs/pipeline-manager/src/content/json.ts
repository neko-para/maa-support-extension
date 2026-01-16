import type { Node } from 'jsonc-parser'

import { buildTree, parseTreeWithoutParent } from '../utils/json'
import type { IContentLoader } from './loader'
import type { IContentWatcher, IContentWatcherController } from './watch'

export class ContentJson<T = any> {
  loader: IContentLoader
  watcher: IContentWatcher
  file: string
  changed: (node?: Node, obj?: T) => void | Promise<void>
  node?: Node
  object?: T

  watcherCtrl?: IContentWatcherController
  duringFlush: boolean
  flushResolve: (() => void)[]
  needFlush: boolean

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    file: string,
    changed: (node?: Node, obj?: T) => void | Promise<void>
  ) {
    this.loader = loader
    this.watcher = watcher
    this.file = file
    this.changed = changed

    this.duringFlush = false
    this.flushResolve = []
    this.needFlush = false
  }

  async load() {
    this.watcherCtrl?.stop()

    this.watcherCtrl = await this.watcher.watch(this.file, {
      filter: (file, isdir) => {
        return true
      },
      fileAdded: file => {
        this.dispatchFlush()
      },
      fileChanged: file => {
        this.dispatchFlush()
      },
      fileDeleted: file => {
        this.dispatchFlush()
      }
    })
    await this.flush()
  }

  async flush() {
    if (this.duringFlush) {
      return new Promise<void>(resolve => {
        this.flushResolve.push(resolve)
      })
    }

    this.duringFlush = true
    this.needFlush = false

    const content = await this.loader.get(this.file)
    if (typeof content === 'string') {
      this.node = parseTreeWithoutParent(content)
    } else {
      this.node = undefined
    }
    if (this.node) {
      this.object = buildTree(this.node)
    } else {
      this.object = undefined
    }

    await this.changed(this.node, this.object)

    const resolves = this.flushResolve
    this.flushResolve = []

    this.duringFlush = false

    process.nextTick(() => {
      for (const func of resolves) {
        func()
      }
    })

    if (this.needFlush) {
      setTimeout(() => {
        this.flush()
      }, 100)
    }
  }

  dispatchFlush(timeout = 100) {
    if (this.needFlush) {
      return
    }
    this.needFlush = true
    setTimeout(() => {
      this.flush()
    }, timeout)
  }
}
