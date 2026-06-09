import chokidar from 'chokidar'
import * as path from 'node:path'

import type { IContentWatcher, IContentWatcherController, IContentWatcherDelegate } from '../types'

export class FsContentWatcher implements IContentWatcher {
  async watch(
    root: string,
    _isFile: boolean,
    delegate: IContentWatcherDelegate
  ): Promise<IContentWatcherController> {
    const watcher = chokidar.watch(root, {
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        return !delegate.filter(path.normalize(file), stats.isDirectory())
      }
    })

    watcher.on('add', file => {
      delegate.fileAdded(file)
    })
    watcher.on('change', file => {
      delegate.fileChanged(file)
    })
    watcher.on('unlink', file => {
      delegate.fileDeleted(file)
    })

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
