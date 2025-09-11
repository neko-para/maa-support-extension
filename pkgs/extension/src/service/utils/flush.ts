import * as vscode from 'vscode'

import { DisposableHelper, context } from '../context'

export abstract class FlushHelper extends DisposableHelper {
  abstract doFlush(): Promise<void>

  flushing: boolean = false
  needFlush: boolean = false
  cacheResolves: (() => void)[] = []

  async flushDirty() {
    if (this.flushing) {
      this.needFlush = true
      return new Promise<void>(resolve => {
        this.cacheResolves.push(resolve)
      })
    }

    this.flushing = true
    await this.doFlush()
    this.flushing = false

    const resolves = this.cacheResolves
    this.cacheResolves = []
    if (resolves.length > 0) {
      setTimeout(() => {
        resolves.forEach(f => f())
      }, 0)
    }

    if (this.needFlush) {
      this.needFlush = false
      setTimeout(() => {
        this.flushDirty()
      }, 0)
    }
  }
}

export abstract class FSWatchFlushHelper extends FlushHelper {
  abstract doUpdate(dirtyPath: string[]): Promise<void>

  watcher: vscode.FileSystemWatcher

  dirtyPaths: Set<string>

  constructor(pattern: vscode.GlobPattern, tester: (uri: vscode.Uri) => boolean) {
    super()

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern)
    context.subscriptions.push(this.watcher)

    this.dirtyPaths = new Set()

    this.defer = vscode.workspace.onDidChangeTextDocument(event => {
      if (tester(event.document.uri)) {
        this.dirtyPaths.add(event.document.uri.fsPath)
      }
    })

    this.watcher.onDidCreate(uri => {
      if (tester(uri)) {
        this.dirtyPaths.add(uri.fsPath)
      }
    })

    this.watcher.onDidDelete(uri => {
      if (tester(uri)) {
        this.dirtyPaths.add(uri.fsPath)
      }
    })

    this.watcher.onDidChange(uri => {
      if (tester(uri)) {
        this.dirtyPaths.add(uri.fsPath)
      }
    })
  }

  async doFlush() {
    const paths = [...this.dirtyPaths]
    this.dirtyPaths = new Set()

    await this.doUpdate(paths)
  }
}
