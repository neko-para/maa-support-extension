import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as os from 'os'
import pacote from 'pacote'
import path from 'path'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare'

import { globalStateService } from '.'
import { BaseService } from './base'

export type RegistryType = 'npm' | 'cnpm'

const registries: Record<RegistryType, string> = {
  npm: 'https://registry.npmjs.org',
  cnpm: 'https://registry.npmmirror.com'
}

function isValidRegistryType(key: unknown): key is RegistryType {
  return typeof key === 'string' && ['npm', 'cnpm'].includes(key)
}

const defaultRegistryType: RegistryType = 'npm'

const defaultMaaVersion = '5.0.0-alpha.3'
const minimumMaaVersion = '5.0.0-alpha.3'

function fixMinimumVersion(ver: string) {
  if (semVerCompare(ver, minimumMaaVersion) === -1) {
    return minimumMaaVersion
  } else {
    return ver
  }
}

export class NativeService extends BaseService {
  registry?: string
  version?: string

  rootFolder: string
  cacheFolder: string
  downloadFolder: string
  installFolder: string

  constructor() {
    super()

    this.rootFolder = path.join(os.homedir(), '.maalsp', 'maa')
    this.cacheFolder = path.join(this.rootFolder, 'cache')
    this.downloadFolder = path.join(this.rootFolder, 'download')
    this.installFolder = path.join(this.rootFolder, 'install')
  }

  async init() {
    this.registry = registries[this.registryType ?? defaultRegistryType]
  }

  get registryType(): RegistryType | null {
    return isValidRegistryType(globalStateService.state.registryType)
      ? globalStateService.state.registryType
      : null
  }

  set registryType(type: RegistryType | null) {
    globalStateService.reduce({
      registryType: type ?? undefined
    })
  }

  get explicitVersion(): string | null {
    if (globalStateService.state.explicitVersion) {
      return fixMinimumVersion(globalStateService.state.explicitVersion)
    } else {
      return null
    }
  }

  set explicitVersion(ver: string | null) {
    globalStateService.reduce({
      explicitVersion: ver ?? undefined
    })
  }
}
