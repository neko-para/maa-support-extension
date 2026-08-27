import chokidar, { type ChokidarOptions, type FSWatcher } from 'chokidar'
import * as path from 'node:path'

export interface IContentWatcherDelegate {
  filter(file: string, isdir: boolean): boolean

  fileAdded(file: string): void
  fileChanged(file: string): void
  fileDeleted(file: string): void
}

export interface IContentWatcherController {
  stop(): void
}

export interface IContentWatcher {
  watch(
    root: string,
    isFile: boolean,
    delegate: IContentWatcherDelegate
  ): Promise<IContentWatcherController>
}

export type FsContentWatcherOptions = Omit<ChokidarOptions, 'ignored'>

export class FsContentWatcher implements IContentWatcher {
  protected readonly options: FsContentWatcherOptions

  constructor(options: FsContentWatcherOptions = {}) {
    this.options = options
  }

  protected createOptions(
    delegate: IContentWatcherDelegate,
    platform: NodeJS.Platform = process.platform
  ): ChokidarOptions {
    return {
      // chokidar 5 creates an fs.watch handle for every matched file. Large Maa
      // resources can exceed macOS's comparatively low open-file limit during
      // the initial scan, while the polling backend does not consume one handle
      // per file.
      usePolling: platform === 'darwin',
      ...this.options,
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        return !delegate.filter(path.normalize(file), stats.isDirectory())
      }
    }
  }

  protected createWatcher(root: string, delegate: IContentWatcherDelegate): FSWatcher {
    return chokidar.watch(root, this.createOptions(delegate))
  }

  async watch(root: string, _isFile: boolean, delegate: IContentWatcherDelegate) {
    const watcher = this.createWatcher(root, delegate)

    watcher.on('add', file => {
      // console.log('add', file)
      delegate.fileAdded(file)
    })
    watcher.on('change', file => {
      // console.log('change', file)
      delegate.fileChanged(file)
    })
    watcher.on('unlink', file => {
      // console.log('unlink', file)
      delegate.fileDeleted(file)
    })
    // watcher.on('addDir', dir => {
    //   console.log('addDir', dir)
    // })
    // watcher.on('unlinkDir', dir => {
    //   console.log('unlinkDir', dir)
    // })

    let resolveReady!: () => void
    let rejectReady!: (error: unknown) => void
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
      watcher.once('ready', resolveReady)
      // Keep this listener installed until startup has either completed or the
      // watcher has closed. A large scan can emit more than one related error;
      // the first one is the useful failure cause and later ones must not become
      // unhandled EventEmitter errors while cleanup is in progress.
      watcher.on('error', rejectReady)
    })

    try {
      await ready
    } catch (error) {
      await watcher.close()
      const detail = error instanceof Error ? `: ${error.message}` : ''
      throw new Error(`Failed to initialize file watcher for "${root}"${detail}`, {
        cause: error
      })
    } finally {
      watcher.off('ready', resolveReady)
      watcher.off('error', rejectReady)
    }

    return {
      stop() {
        void watcher.close()
      }
    }
  }
}
