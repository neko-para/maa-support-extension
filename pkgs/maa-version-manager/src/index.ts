import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as pacote from 'pacote'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare'

export type NpmRegistryType = keyof typeof MaaVersionManager.registries

export class MaaVersionManager {
  static readonly registries = {
    npm: 'https://registry.npmjs.org',
    cnpm: 'https://registry.npmmirror.com'
  }
  static isValidRegistryType(key: unknown): key is NpmRegistryType {
    return typeof key === 'string' && Object.keys(MaaVersionManager.registries).includes(key)
  }

  root: string
  registry: string

  get downloadPath() {
    return path.join(this.root, 'download')
  }

  get installPath() {
    return path.join(this.root, 'install')
  }

  constructor(root: string) {
    this.root = root
    this.registry = MaaVersionManager.registries.npm
  }

  async init() {
    await fs.mkdir(this.downloadPath, { recursive: true })
    await fs.mkdir(this.installPath, { recursive: true })
  }

  lock() {
    return lock(this.root).then(
      release => release,
      () => null
    )
  }

  versionFolder(version: string) {
    return path.join(this.installPath, version)
  }

  moduleFolder(version: string) {
    return path.join(this.installPath, version, 'node_modules')
  }

  async fetchAllLocalVersions() {
    let release = await this.lock()
    if (!release) {
      return []
    }

    const localVersions = (await fs.readdir(this.installPath, { withFileTypes: true }))
      .filter(info => info.isDirectory())
      .map(info => info.name)
    await release()
    return localVersions
  }

  async fetchAllVersions(minimumVersion: string) {
    let release = await this.lock()
    if (!release) {
      return []
    }

    try {
      const result = await pacote.packument('@maaxyz/maa-node', {
        registry: this.registry
      })
      await release()
      return Object.entries(result.versions).filter(([ver]) => {
        return semVerCompare(ver, minimumVersion) !== -1
      })
    } catch {
      await release()
      return []
    }
  }

  async fetchLatest() {
    let release = await this.lock()
    if (!release) {
      return null
    }

    try {
      const result = await pacote.manifest('@maaxyz/maa-node@latest', {
        registry: this.registry
      })
      await release()
      return result
    } catch {
      await release()
      return null
    }
  }

  async prepare(
    version: string,
    progress: (
      msg: 'prepare-folder' | 'download-scripts' | 'download-binary' | 'move-folders' | 'finish'
    ) => void
  ) {
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

    progress('prepare-folder')

    const loaderTemp = await fs.mkdtemp(path.join(this.downloadPath, 'loader-'))
    const binaryTemp = await fs.mkdtemp(path.join(this.downloadPath, 'binary-'))

    progress('download-scripts')

    await pacote.extract(`@maaxyz/maa-node@${version}`, loaderTemp, {
      registry: this.registry
    })

    progress('download-binary')

    await pacote.extract(
      `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
      binaryTemp,
      {
        registry: this.registry
      }
    )

    progress('move-folders')

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

    progress('finish')

    release()
    return true
  }

  async cleanUnused(skipVersions: string[] = []) {
    let release = await this.lock()
    if (!release) {
      return
    }

    for (const info of await fs.readdir(this.installPath, { withFileTypes: true })) {
      if (!info.isDirectory()) {
        continue
      }
      if (skipVersions.includes(info.name)) {
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
