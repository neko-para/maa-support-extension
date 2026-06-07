import type { IContentLoader } from '../io/loader'
import type { IContentWatcher, IContentWatcherController } from '../io/watch'
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

  private flushing = false
  private queued = false
  private timer?: ReturnType<typeof setTimeout>
  private flushComplete?: Promise<void>
  private flushResolve?: () => void

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
  }

  async load() {
    this.watcherCtrl?.stop()
    await this.delegate.reset()
    this.changed.clear()
    this.removed.clear()

    this.watcherCtrl = await this.watcher.watch(this.root, false, {
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
