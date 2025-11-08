import { InterfaceConfig } from './pi_config'

export type GlobalState = {
  registryType?: string
  explicitVersion?: string
}

export type LocalState = {
  activeInterface?: string
  interfaceConfig?: Partial<InterfaceConfig>
}
