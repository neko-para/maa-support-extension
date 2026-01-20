import path from 'node:path'

import type { IContentLoader } from '../content/loader'
import type { IContentWatcher, IContentWatcherController } from '../content/watch'
import { type AbsolutePath, type RelativePath, relativePath } from '../utils/types'

export interface IBundleManagerDelegate {
  filterFile(file: AbsolutePath, isdir: boolean): boolean
  needContent(file: AbsolutePath): boolean

  reset(): Promise<void>
  loadFile(file: RelativePath, full: AbsolutePath, content?: string): Promise<void>
  deleteFile(file: RelativePath, full: AbsolutePath): Promise<void>
}

export class BundleManager {
  loader: IContentLoader
  watcher: IContentWatcher
  root: AbsolutePath
  delegate: IBundleManagerDelegate

  changed: Set<AbsolutePath>
  removed: Set<AbsolutePath>
  watcherCtrl?: IContentWatcherController
  duringFlush: boolean
  flushResolve: (() => void)[]
  needFlush: boolean

  constructor(
    loader: IContentLoader,
    watcher: IContentWatcher,
    root: AbsolutePath,
    delegate: IBundleManagerDelegate
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
        return this.delegate.filterFile(file as AbsolutePath, isdir)
      },
      fileAdded: (file: string) => {
        this.changed.add(file as AbsolutePath)
        this.removed.delete(file as AbsolutePath)

        this.dispatchFlush()
      },
      fileChanged: (file: string) => {
        this.changed.add(file as AbsolutePath)
        this.removed.delete(file as AbsolutePath)

        this.dispatchFlush()
      },
      fileDeleted: (file: string) => {
        this.removed.add(file as AbsolutePath)
        this.changed.delete(file as AbsolutePath)

        this.dispatchFlush()
      }
    })
    await this.flush()
  }

  stop() {
    this.watcherCtrl?.stop()
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
      await this.delegate.deleteFile(relativePath(this.root, file), file)
    }

    for (const file of changed) {
      if (this.delegate.needContent(file)) {
        const content = await this.loader.get(file)
        if (typeof content === 'string') {
          await this.delegate.loadFile(relativePath(this.root, file), file, content)
        } else {
          await this.delegate.deleteFile(relativePath(this.root, file), file)
        }
      } else {
        await this.delegate.loadFile(relativePath(this.root, file), file)
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
