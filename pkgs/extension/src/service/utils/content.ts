import * as path from 'node:path'
import * as vscode from 'vscode'

import {
  FsContentWatcher,
  type IContentLoader,
  type IContentWatcher,
  type IContentWatcherDelegate
} from '@nekosu/maa-pipeline-manager'

export class VscodeContentLoader implements IContentLoader {
  async get(file: string) {
    try {
      const doc = await vscode.workspace.openTextDocument(file)
      return doc.getText()
    } catch {
      return null
    }
  }
}

export class VscodeContentWatcher extends FsContentWatcher implements IContentWatcher {
  async watch(root: string, isFile: boolean, delegate: IContentWatcherDelegate) {
    let disp: vscode.Disposable
    if (isFile) {
      disp = vscode.workspace.onDidChangeTextDocument(ev => {
        const file = ev.document.uri.fsPath
        if (root === file) {
          delegate.fileChanged(file)
        }
      })
    } else {
      const prefix = vscode.Uri.file(root).fsPath + path.sep
      disp = vscode.workspace.onDidChangeTextDocument(ev => {
        const file = ev.document.uri.fsPath
        if (file.startsWith(prefix)) {
          delegate.fileChanged(file)
        }
      })
    }

    const watcher = await super.watch(root, isFile, delegate)

    return {
      stop() {
        watcher.stop()
        disp.dispose()
      }
    }
  }
}
