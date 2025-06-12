import * as vscode from 'vscode'

export let context: vscode.ExtensionContext

export function init(ctx: vscode.ExtensionContext) {
  context = ctx
}

export class DisposableHelper {
  set defer(v: vscode.Disposable) {
    context.subscriptions.push(v)
  }
}

export class BaseService extends DisposableHelper {
  async init() {}
}
