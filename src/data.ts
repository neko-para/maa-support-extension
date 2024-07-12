import * as vscode from 'vscode'

import { InheritDisposable } from './disposable'

const sharedInstanceMap = new Map<vscode.ExtensionContext, Map<string, unknown>>()

type ServiceConstructor<T extends Service> = (new (context: vscode.ExtensionContext) => T) & {
  name: string
}

export function sharedInstance<T extends Service>(
  ctx: vscode.ExtensionContext,
  cls: ServiceConstructor<T>
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

export class Service extends InheritDisposable {
  __context: vscode.ExtensionContext

  constructor(context: vscode.ExtensionContext) {
    super()

    this.__context = context
  }

  shared<T extends Service>(cls: ServiceConstructor<T>) {
    return sharedInstance(this.__context, cls)
  }
}

export function loadServices(
  context: vscode.ExtensionContext,
  clss: ServiceConstructor<Service>[]
) {
  for (const cls of clss) {
    sharedInstance(context, cls)
  }
}
