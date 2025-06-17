import type { Interface, InterfaceConfig } from '../pi'

export type LaunchHostState = {
  stopped?: boolean
}

export type LaunchHostToWeb =
  | {
      command: 'updateState'
      state: LaunchHostState
    }
  | {
      command: 'notifyStatus'
      msg: string
      details: string
    }

export type LaunchWebToHost = {
  command: 'requestStop'
}
