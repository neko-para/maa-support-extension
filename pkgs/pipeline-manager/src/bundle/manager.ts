import path from 'node:path'

import type { IContentLoader } from './loader'
import type { IContentWatcher, IContentWatcherController } from './watch'

export interface IContentManagerDelegate {
  filterFile(file: string, isdir: boolean): boolean
  needContent(file: string): boolean

  reset(): Promise<void>
  loadFile(file: string, full: string, content?: string): Promise<void>
  deleteFile(file: string, full: string): Promise<void>
}

export class ContentManager {
  loader: IContentLoader
  watcher: IContentWatcher
  root: string
  delegate: IContentManagerDelegate

  changed: Set<string>
  removed: Set<string>
  watcherCtrl?: IContentWatcherController
  duringFlush: boolean
  flushResolve: (() => void)[]
  needFlush: boolean

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    root: string,
    delegate: IContentManagerDelegate
  ) {
    this.loader = loader
    this.watcher = watcher
    this.root = root
    this.delegate = delegate

    this.changed = new Set()
    this.removed = new Set()
    this.duringFlush = false
    this.flushResolve = []
    this.needFlush = false
  }

  async load() {
    this.watcherCtrl?.stop()
    await this.delegate.reset()
    this.changed.clear()
    this.removed.clear()

    this.watcherCtrl = await this.watcher.watch(this.root, {
      filter: (file: string, isdir: boolean) => {
        return this.delegate.filterFile(file, isdir)
      },
      fileAdded: (file: string) => {
        this.changed.add(file)
        this.removed.delete(file)

        this.dispatchFlush()
      },
      fileChanged: (file: string) => {
        this.changed.add(file)
        this.removed.delete(file)

        this.dispatchFlush()
      },
      fileDeleted: (file: string) => {
        this.removed.add(file)
        this.changed.delete(file)

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

    const changed = this.changed
    const removed = this.removed

    this.changed = new Set()
    this.removed = new Set()

    for (const file of removed) {
      await this.delegate.deleteFile(path.relative(this.root, file), file)
    }

    for (const file of changed) {
      if (this.delegate.needContent(file)) {
        const content = await this.loader.get(file)
        if (typeof content === 'string') {
          await this.delegate.loadFile(path.relative(this.root, file), file, content)
        } else {
          await this.delegate.deleteFile(path.relative(this.root, file), file)
        }
      } else {
        await this.delegate.loadFile(path.relative(this.root, file), file)
      }
    }

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
      }, 50)
    }
  }

  dispatchFlush(timeout = 50) {
    if (this.needFlush) {
      return
    }
    this.needFlush = true
    setTimeout(() => {
      this.flush()
    }, timeout)
  }
}
