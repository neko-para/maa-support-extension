import { extensionContext } from 'reactive-vscode'

import { InheritDisposable } from './disposable'

const sharedInstanceMap = new Map<string, Service>()

type ServiceConstructor<T extends Service> = (new () => T) & {
  name: string
}

export function sharedInstance<T extends Service>(cls: ServiceConstructor<T>) {
  if (sharedInstanceMap.has(cls.name)) {
    return sharedInstanceMap.get(cls.name)! as T
  } else {
    const inst = new cls()
    extensionContext.value?.subscriptions.push(inst)
    sharedInstanceMap.set(cls.name, inst)
    return inst
  }
}

export function resetInstance() {
  for (const [, inst] of sharedInstanceMap) {
    inst.dispose()
  }
  sharedInstanceMap.clear()
}

export class Service extends InheritDisposable {
  constructor() {
    super()
  }

  get context() {
    return extensionContext.value!
  }

  shared<T extends Service>(cls: ServiceConstructor<T>) {
    return sharedInstance(cls)
  }
}

export function loadServices(clss: ServiceConstructor<Service>[]) {
  for (const cls of clss) {
    sharedInstance(cls)
  }
}
