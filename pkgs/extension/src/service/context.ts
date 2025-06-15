import * as vscode from 'vscode'

export let context: vscode.ExtensionContext

export function init(ctx: vscode.ExtensionContext) {
  context = ctx
}

export class DisposableHelper implements vscode.Disposable {
  __dispose: (() => void)[] = []

  constructor() {
    context.subscriptions.push(this)
  }

  set defer(v: vscode.Disposable) {
    this.__dispose.push(() => v.dispose())
  }

  dispose() {
    const disp = this.__dispose
    this.__dispose = []
    disp.forEach(f => f())
  }
}

export class BaseService extends DisposableHelper {
  async init() {}
}
