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
  watch(root: string, delegate: IContentWatcherDelegate): Promise<IContentWatcherController>
}

export class FsContentWatcher implements IContentWatcher {
  async watch(root: string, delegate: IContentWatcherDelegate) {
    const watcher = chokidar.watch(root, {
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        return !delegate.filter(file, stats.isDirectory())
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

export class VscodeContentWatcher extends FsContentWatcher implements IContentWatcher {
  vscode: typeof import('vscode')

  constructor(vscode: typeof import('vscode')) {
    super()

    this.vscode = vscode
  }

  async watch(root: string, delegate: IContentWatcherDelegate) {
    const prefix = this.vscode.Uri.file(root).fsPath + path.sep
    const disp = this.vscode.workspace.onDidChangeTextDocument(ev => {
      const file = ev.document.uri.fsPath
      if (file.startsWith(prefix)) {
        delegate.fileChanged(file)
      }
    })

    const watcher = await super.watch(root, delegate)

    return {
      stop() {
        watcher.stop()
        disp.dispose()
      }
    }
  }
}
