import type { Interface } from './pi'
import { InterfaceRuntime } from './pi_config'

export type ControlViewState = {
  interface?: string[]
  refreshingInterface?: boolean

  interfaceJson?: Partial<Interface>
}

export type LaunchViewState = {
  runtime?: InterfaceRuntime
}
