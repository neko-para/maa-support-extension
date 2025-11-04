import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as os from 'os'
import pacote from 'pacote'
import path from 'path'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare'

import { globalStateService } from '.'
import { handle } from '../server'
import { BaseService } from './base'

export type RegistryType = 'npm' | 'cnpm'

const allRegistryTypes = ['npm', 'cnpm'] as const

const registries: Record<RegistryType, string> = {
  npm: 'https://registry.npmjs.org',
  cnpm: 'https://registry.npmmirror.com'
}

function isValidRegistryType(key: unknown): key is RegistryType {
  return typeof key === 'string' && allRegistryTypes.includes(key as RegistryType)
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
  downloadFolder: string
  installFolder: string

  constructor() {
    super()

    this.rootFolder = path.join(os.homedir(), '.maalsp', 'maa')
    this.downloadFolder = path.join(this.rootFolder, 'download')
    this.installFolder = path.join(this.rootFolder, 'install')
  }

  async init() {
    await fs.mkdir(this.installFolder, { recursive: true })
    await fs.mkdir(this.downloadFolder, { recursive: true })

    this.registry = registries[this.registryType ?? defaultRegistryType]
    this.version = this.explicitVersion ?? defaultMaaVersion
  }

  listen() {
    handle('/native/listRegistry', req => {
      const curr = this.registry
      return allRegistryTypes.map(type => {
        return {
          name: type,
          url: registries[type],
          using: curr === registries[type]
        }
      })
    })
    handle('/native/listVersion', async req => {
      const curr = this.version
      const allLocal = await this.fetchAllLocalVersions()
      const allRemote = (await this.fetchAllRemoteVersions()).map(x => x[0])
      allRemote.sort((a, b) => -semVerCompare(a, b))

      return allRemote.map(ver => {
        return {
          version: ver,
          local: allLocal.includes(ver),
          using: ver === curr
        }
      })
    })
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

  lock() {
    return lock(this.rootFolder).then(
      release => release,
      () => null
    )
  }

  versionFolder(version: string) {
    return path.join(this.installFolder, version)
  }

  async fetchAllLocalVersions() {
    let release = await this.lock()
    if (!release) {
      return []
    }

    const localVersions = (await fs.readdir(this.installFolder, { withFileTypes: true }))
      .filter(info => info.isDirectory())
      .map(info => info.name)
    await release()
    return localVersions
  }

  async fetchAllRemoteVersions() {
    let release = await this.lock()
    if (!release) {
      return []
    }

    const result = await pacote.packument('@maaxyz/maa-node', {
      registry: this.registry
    })
    await release()
    return Object.entries(result.versions).filter(([ver]) => {
      return semVerCompare(ver, minimumMaaVersion) !== -1
    })
  }

  async prepare(version: string) {
    const versionFolder = this.versionFolder(version)

    const release = await this.lock()
    if (!release) {
      return false
    }

    if (existsSync(versionFolder)) {
      await fs.writeFile(path.join(versionFolder, 'timestamp'), Date.now().toString())
      await release()
      return true
    }

    const loaderTemp = await fs.mkdtemp(path.join(this.downloadFolder, 'loader-'))
    const binaryTemp = await fs.mkdtemp(path.join(this.downloadFolder, 'binary-'))

    await pacote.extract(`@maaxyz/maa-node@${version}`, loaderTemp, {
      registry: this.registry
    })
    await pacote.extract(
      `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
      binaryTemp,
      {
        registry: this.registry
      }
    )

    await fs.mkdir(path.join(versionFolder, 'node_modules', '@maaxyz'), {
      recursive: true
    })
    await fs.writeFile(path.join(versionFolder, 'timestamp'), Date.now().toString())

    await fs.rename(loaderTemp, path.join(versionFolder, 'node_modules', '@maaxyz', 'maa-node'))
    await fs.rename(
      binaryTemp,
      path.join(
        versionFolder,
        'node_modules',
        '@maaxyz',
        `maa-node-${process.platform}-${process.arch}`
      )
    )

    release()
    return true
  }

  async load() {
    if (!this.version) {
      return false
    }

    if (globalThis.maa) {
      return true
    }

    if (!(await this.prepare(this.version))) {
      return false
    }

    module.paths.unshift(path.join(this.versionFolder(this.version), 'node_modules'))

    try {
      require('@maaxyz/maa-node')
    } catch {
      return false
    }

    this.cleanUnused()

    return true
  }

  async cleanUnused() {
    let release = await this.lock()
    if (!release) {
      return
    }

    for (const info of await fs.readdir(this.installFolder, { withFileTypes: true })) {
      if (!info.isDirectory()) {
        continue
      }
      if (info.name == this.version) {
        continue
      }
      const versionFolder = this.versionFolder(info.name)
      const timestampFile = path.join(versionFolder, 'timestamp')
      if (existsSync(timestampFile)) {
        const content = await fs.readFile(timestampFile, 'utf8')
        const delta = Date.now() - parseInt(content)

        if (delta > 7 * 24 * 60 * 60 * 1000) {
          await fs.rm(versionFolder, { recursive: true })
        }
      } else {
        await fs.rm(versionFolder, { recursive: true })
      }
    }
    await release()
  }
}
