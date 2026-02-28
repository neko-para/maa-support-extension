import chokidar from 'chokidar'
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

export class FsContentWatcher implements IContentWatcher {
  async watch(root: string, _isFile: boolean, delegate: IContentWatcherDelegate) {
    const watcher = chokidar.watch(root, {
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        return !delegate.filter(path.normalize(file), stats.isDirectory())
      }
    })

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

    await new Promise<void>(resolve => {
      watcher.on('ready', () => {
        resolve()
      })
    })

    return {
      stop() {
        watcher.close()
      }
    }
  }
}
