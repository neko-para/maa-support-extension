import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import pacote from 'pacote'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare'
import * as vscode from 'vscode'

import { t } from '@mse/utils'

import packageJson from '../../package.json'
import { commands } from '../command'
import { BaseService, context } from './context'

const registries = {
  npm: 'https://registry.npmjs.org',
  cnpm: 'https://registry.npmmirror.com'
}

function isValidRegistryType(key: unknown): key is keyof typeof registries {
  return typeof key === 'string' && ['npm', 'cnpm'].includes(key)
}

const defaultRegistryType = 'npm'

const defaultMaaVersion = packageJson.devDependencies['@maaxyz/maa-node']
const minimumMaaVersion = '5.5.0-beta.3'

function fixMinimumVersion(ver: string) {
  if (semVerCompare(ver, minimumMaaVersion) === -1) {
    return minimumMaaVersion
  } else {
    return ver
  }
}

export class NativeService extends BaseService {
  registry: string
  version: string

  rootUri: vscode.Uri
  downloadUri: vscode.Uri
  installUri: vscode.Uri

  constructor() {
    super()
    console.log('construct NativeService')

    this.registry = registries[this.registryType ?? defaultRegistryType]
    this.version = this.explicitVersion ?? defaultMaaVersion

    this.rootUri = vscode.Uri.joinPath(context.globalStorageUri, 'native')
    this.downloadUri = vscode.Uri.joinPath(this.rootUri, 'download')
    this.installUri = vscode.Uri.joinPath(this.rootUri, 'install')

    const cacheDir = vscode.Uri.joinPath(this.rootUri, 'cache')
    if (existsSync(cacheDir.fsPath)) {
      fs.rm(cacheDir.fsPath, { recursive: true })
    }
  }

  async init() {
    console.log('init NativeService')

    await fs.mkdir(this.installUri.fsPath, { recursive: true })
    await fs.mkdir(this.downloadUri.fsPath, { recursive: true })

    this.defer = vscode.commands.registerCommand(commands.NativeSelectRegistry, async () => {
      let previous = this.registryType

      const options: (vscode.QuickPickItem & { value: keyof typeof registries | null })[] =
        Object.keys(registries)
          .filter(isValidRegistryType)
          .map(type => {
            const descTags: string[] = []
            if (this.registry === registries[type]) {
              descTags.push(t('maa.native.in-use'))
            }
            if (type === previous) {
              descTags.push('$(check)')
            } else if (!previous && type == defaultRegistryType) {
              descTags.push('$(check)')
            }
            return {
              label: type,
              description: descTags.join(' '),
              detail: registries[type],
              value: type
            }
          })

      const result = await vscode.window.showQuickPick(options, {
        title: t('maa.native.switch-mirror')
      })
      if (result) {
        this.registryType = result.value
      }
    })

    this.defer = vscode.commands.registerCommand(commands.NativeSelectMaa, async () => {
      let allLocal: string[] = []
      let allRemote: string[] = []

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: t('maa.native.fetching-index')
        },
        async progress => {
          progress.report({
            increment: 0
          })
          allLocal = await this.fetchAllLocalVersions()
          allRemote = (await this.fetchAllVersions()).map(x => x[0])
          allRemote.sort((a, b) => -semVerCompare(a, b))
        }
      )

      let previous = this.explicitVersion

      const options: (vscode.QuickPickItem & { value: string | null })[] = allRemote.map(ver => {
        const descTags: string[] = []
        if (allLocal.includes(ver)) {
          descTags.push(t('maa.native.downloaded'))
        }
        if (this.version === ver) {
          descTags.push(t('maa.native.in-use'))
        }
        if (ver === previous) {
          descTags.push('$(check)')
        }
        return {
          label: ver,
          description: descTags.join(' '),
          detail: ver == defaultMaaVersion ? t('maa.native.extension-expected-version') : '',
          value: ver
        }
      })
      options.unshift({
        label: t('maa.native.auto'),
        description: null === previous ? '$(check)' : '',
        detail: t('maa.native.use-extension-expected-version'),
        value: null
      })

      const result = await vscode.window.showQuickPick(options, {
        title: t('maa.native.switch-maafw')
      })
      if (result) {
        this.explicitVersion = result.value
      }
    })
  }

  get registryType() {
    const value = context.globalState.get('NativeService:registry')
    return isValidRegistryType(value) ? value : null
  }

  set registryType(value: keyof typeof registries | null) {
    if (value && isValidRegistryType(value)) {
      context.globalState.update('NativeService:registry', value)
    } else {
      context.globalState.update('NativeService:registry', undefined)
    }
  }

  get explicitVersion() {
    const value = context.globalState.get('NativeService:version')
    if (typeof value === 'string' && value.length > 0) {
      return fixMinimumVersion(value)
    } else {
      return null
    }
  }

  set explicitVersion(value: string | null) {
    if (value && value.length > 0) {
      context.globalState.update('NativeService:version', value)
    } else {
      context.globalState.update('NativeService:version', undefined)
    }
  }

  lock() {
    return lock(this.rootUri.fsPath).then(
      release => release,
      () => null
    )
  }

  versionFolder(version: string) {
    return vscode.Uri.joinPath(this.installUri, version)
  }

  async fetchAllLocalVersions() {
    let release = await this.lock()
    if (!release) {
      return []
    }

    const localVersions = (await fs.readdir(this.installUri.fsPath, { withFileTypes: true }))
      .filter(info => info.isDirectory())
      .map(info => info.name)
    await release()
    return localVersions
  }

  async fetchAllVersions() {
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
        return semVerCompare(ver, minimumMaaVersion) !== -1
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

  async update() {
    const info = await this.fetchLatest()
    if (!info) {
      return false
    }
    return await this.prepare(info.version)
  }

  async prepare(version: string) {
    const versionFolder = this.versionFolder(version)

    const release = await this.lock()
    if (!release) {
      return false
    }

    if (existsSync(versionFolder.fsPath)) {
      await fs.writeFile(
        vscode.Uri.joinPath(versionFolder, 'timestamp').fsPath,
        Date.now().toString()
      )
      await release()
      return true
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification
      },
      async progress => {
        progress.report({
          message: t('maa.native.download.preparing-folder')
        })
        const loaderTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'loader-').fsPath)
        const binaryTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'binary-').fsPath)
        progress.report({
          message: t('maa.native.download.downloading-scripts', version),
          increment: 10
        })
        await pacote.extract(`@maaxyz/maa-node@${version}`, loaderTemp, {
          registry: this.registry
        })
        progress.report({
          message: t('maa.native.download.downloading-binary', version),
          increment: 40
        })
        await pacote.extract(
          `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
          binaryTemp,
          {
            registry: this.registry
          }
        )
        progress.report({
          message: t('maa.native.download.moving-folder'),
          increment: 40
        })

        await fs.mkdir(vscode.Uri.joinPath(versionFolder, 'node_modules', '@maaxyz').fsPath, {
          recursive: true
        })
        await fs.writeFile(
          vscode.Uri.joinPath(versionFolder, 'timestamp').fsPath,
          Date.now().toString()
        )

        await fs.rename(
          loaderTemp,
          vscode.Uri.joinPath(versionFolder, 'node_modules', '@maaxyz', 'maa-node').fsPath
        )
        await fs.rename(
          binaryTemp,
          vscode.Uri.joinPath(
            versionFolder,
            'node_modules',
            '@maaxyz',
            `maa-node-${process.platform}-${process.arch}`
          ).fsPath
        )

        progress.report({
          increment: 10
        })
      }
    )

    release()
    return true
  }

  get activeModulePath() {
    return vscode.Uri.joinPath(this.versionFolder(this.version), 'node_modules').fsPath
  }

  async load() {
    if (globalThis.maa) {
      return true
    }

    if (!(await this.prepare(this.version))) {
      return false
    }

    if (false) {
      module.paths.unshift(this.activeModulePath)

      try {
        require('@maaxyz/maa-node')
      } catch {
        return false
      }
    }

    this.cleanUnused()

    return true
  }

  async cleanUnused() {
    let release = await this.lock()
    if (!release) {
      return
    }

    for (const info of await fs.readdir(this.installUri.fsPath, { withFileTypes: true })) {
      if (!info.isDirectory()) {
        continue
      }
      if (info.name == this.version) {
        continue
      }
      const versionFolder = this.versionFolder(info.name)
      const timestampFile = vscode.Uri.joinPath(versionFolder, 'timestamp').fsPath
      if (existsSync(timestampFile)) {
        const content = await fs.readFile(timestampFile, 'utf8')
        const delta = Date.now() - parseInt(content)

        if (delta > 7 * 24 * 60 * 60 * 1000) {
          await fs.rm(versionFolder.fsPath, { recursive: true })
        }
      } else {
        await fs.rm(versionFolder.fsPath, { recursive: true })
      }
    }
    await release()
  }

  get currentVersionInfo(): string[] {
    let loadedVersion: string | undefined = undefined
    if (globalThis.maa) {
      loadedVersion = maa.Global.version
    }

    return [
      `${t('maa.native.loaded-ver')}: ${this.version}${loadedVersion ? '' : ` <${t('maa.status.not-loaded')}>`}`,
      `${t('maa.native.ext-int-ver')}: ${defaultMaaVersion}`
    ]
  }
}
