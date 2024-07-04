import * as vscode from 'vscode'

export class InheritDisposable implements vscode.Disposable {
  __deferred: vscode.Disposable[] = []

  set defer(d: vscode.Disposable) {
    this.__deferred.push(d)
  }

  dispose() {
    this.__deferred.forEach(x => x.dispose())
  }
}
