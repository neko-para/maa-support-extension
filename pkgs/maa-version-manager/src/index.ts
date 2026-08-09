import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import pacote from 'pacote'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare.js'

export type NpmRegistryType = keyof typeof MaaVersionManager.registries

export class MaaVersionManager {
  static readonly registries = {
    npm: 'https://registry.npmjs.org',
    cnpm: 'https://registry.npmmirror.com'
  } as const
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

  constructor(root: string, registry: string = MaaVersionManager.registries.npm) {
    this.root = root
    this.registry = registry
  }

  async init() {
    await fs.mkdir(this.downloadPath, { recursive: true })
    await fs.mkdir(this.installPath, { recursive: true })
  }

  lock(): Promise<(() => Promise<void>) | null> {
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

  private loaderFolder(versionFolder: string) {
    return path.join(versionFolder, 'node_modules', '@maaxyz', 'maa-node')
  }

  private binaryFolder(versionFolder: string) {
    return path.join(
      versionFolder,
      'node_modules',
      '@maaxyz',
      `maa-node-${process.platform}-${process.arch}`
    )
  }

  private isPrepared(versionFolder: string) {
    return (
      existsSync(path.join(versionFolder, 'timestamp')) &&
      existsSync(this.loaderFolder(versionFolder)) &&
      existsSync(this.binaryFolder(versionFolder))
    )
  }

  protected async extract(packageSpec: string, destination: string, registry = this.registry) {
    await pacote.extract(packageSpec, destination, {
      registry
    })
  }

  protected async commitInstall(stagingFolder: string, versionFolder: string) {
    await fs.rename(stagingFolder, versionFolder)
  }

  async fetchAllLocalVersions() {
    const release = await this.lock()
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
    const registry = this.registry
    const release = await this.lock()
    if (!release) {
      return []
    }

    try {
      const result = await pacote.packument('@maaxyz/maa-node', {
        registry
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

  async fetchLatest(): Promise<(pacote.AbbreviatedManifest & pacote.ManifestResult) | null> {
    const registry = this.registry
    const release = await this.lock()
    if (!release) {
      return null
    }

    try {
      const result = await pacote.manifest('@maaxyz/maa-node@latest', {
        registry
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
    const registry = this.registry
    const versionFolder = this.versionFolder(version)

    const release = await this.lock()
    if (!release) {
      return false
    }

    let stagingFolder: string | null = null
    let progressStarted = false

    try {
      if (this.isPrepared(versionFolder)) {
        await fs.writeFile(path.join(versionFolder, 'timestamp'), Date.now().toString())
        return true
      }

      if (existsSync(versionFolder)) {
        await fs.rm(versionFolder, { recursive: true, force: true })
      }

      progress('prepare-folder')
      progressStarted = true

      stagingFolder = await fs.mkdtemp(path.join(this.installPath, '.prepare-'))
      await fs.mkdir(path.join(stagingFolder, 'node_modules', '@maaxyz'), { recursive: true })

      progress('download-scripts')
      const loaderFolder = this.loaderFolder(stagingFolder)
      await fs.mkdir(loaderFolder)
      await this.extract(`@maaxyz/maa-node@${version}`, loaderFolder, registry)

      progress('download-binary')
      const binaryFolder = this.binaryFolder(stagingFolder)
      await fs.mkdir(binaryFolder)
      await this.extract(
        `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
        binaryFolder,
        registry
      )

      progress('move-folders')
      await fs.writeFile(path.join(stagingFolder, 'timestamp'), Date.now().toString())
      await this.commitInstall(stagingFolder, versionFolder)
      stagingFolder = null

      return true
    } catch {
      return false
    } finally {
      try {
        if (stagingFolder) {
          await fs.rm(stagingFolder, { recursive: true, force: true })
        }
      } finally {
        try {
          if (progressStarted) {
            progress('finish')
          }
        } finally {
          await release()
        }
      }
    }
  }

  async cleanUnused(skipVersions: string[] = []) {
    const release = await this.lock()
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
