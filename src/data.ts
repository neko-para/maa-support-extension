import * as vscode from 'vscode'

const sharedInstanceMap = new Map<vscode.ExtensionContext, Map<string, unknown>>()

export function sharedInstance<T extends vscode.Disposable>(
  ctx: vscode.ExtensionContext,
  cls: (new (context: vscode.ExtensionContext) => T) & { name: string }
) {
  if (!sharedInstanceMap.has(ctx)) {
    sharedInstanceMap.set(ctx, new Map())
  }
  const subMap = sharedInstanceMap.get(ctx)!
  if (subMap.has(cls.name)) {
    return subMap.get(cls.name)! as T
  } else {
    const inst = new cls(ctx)
    ctx.subscriptions.push(inst)
    subMap.set(cls.name, inst)
    return inst
  }
}

export function resetInstance() {
  sharedInstanceMap.clear()
}
