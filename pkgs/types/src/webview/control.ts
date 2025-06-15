import type { Interface, InterfaceConfig } from '../pi'

export type ControlHostState = {
  interface?: string[]
  activeInterface?: string
  refreshingInterface?: boolean

  interfaceJson?: Partial<Interface>
  interfaceConfigJson?: Partial<InterfaceConfig>
}

export type ControlHostToWeb = {
  command: 'updateState'
  state: ControlHostState
}

export type ControlWebToHost =
  | {
      // return
      command: 'refreshInterface'
    }
  | {
      command: 'selectInterface'
      path: string
    }
