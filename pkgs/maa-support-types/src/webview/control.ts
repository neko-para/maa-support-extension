import type { Interface } from '../pi'
import { InterfaceConfig } from '../pi_config'

export type ControlViewState = {
  interface?: string[]
  refreshingInterface?: boolean

  interfaceJson?: Partial<Interface>
}
