import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import pacote from 'pacote'
import { lock } from 'proper-lockfile'
import semVerCompare from 'semver/functions/compare'
import * as vscode from 'vscode'

import { commands } from '../command'
import { maa, setMaa } from '../maa'
import { BaseService, context } from './context'

const registries = {
  npm: 'https://registry.npmjs.org',
  taobao: 'https://registry.npm.taobao.org'
}

function isValidRegistryType(key: unknown): key is keyof typeof registries {
  return typeof key === 'string' && ['npm', 'taobao'].includes(key)
}

const defaultRegistryType = 'npm'

const defaultMaaVersion = '4.4.0-beta.1'

export class NativeService extends BaseService {
  registry: string
  version: string

  rootUri: vscode.Uri
  cacheUri: vscode.Uri
  downloadUri: vscode.Uri
  installUri: vscode.Uri

  constructor() {
    super()
    console.log('construct NativeService')

    this.registry = registries[this.registryType ?? defaultRegistryType]
    this.version = this.explicitVersion ?? defaultMaaVersion

    this.rootUri = vscode.Uri.joinPath(context.globalStorageUri, 'native')
    this.cacheUri = vscode.Uri.joinPath(this.rootUri, 'cache')
    this.downloadUri = vscode.Uri.joinPath(this.rootUri, 'download')
    this.installUri = vscode.Uri.joinPath(this.rootUri, 'install')
  }

  async init() {
    console.log('init NativeService')

    await fs.mkdir(this.cacheUri.fsPath, { recursive: true })
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
              descTags.push('正在使用')
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
        title: '切换下载源(重启生效)'
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
          title: '获取索引中'
        },
        async progress => {
          progress.report({
            increment: 0
          })
          allLocal = await this.fetchAllLocalVersions()
          allRemote = (await this.fetchAllVersions()).map(x => x[0])
          allRemote.sort((a, b) => -semVerCompare(a, b))
          progress.report({
            increment: 100
          })
        }
      )

      let previous = this.explicitVersion

      const options: (vscode.QuickPickItem & { value: string | null })[] = allRemote.map(ver => {
        const descTags: string[] = []
        if (allLocal.includes(ver)) {
          descTags.push('已下载')
        }
        if (this.version === ver) {
          descTags.push('正在使用')
        }
        if (ver === previous) {
          descTags.push('$(check)')
        }
        return {
          label: ver,
          description: descTags.join(' '),
          detail: ver == defaultMaaVersion ? '插件预期版本' : '',
          value: ver
        }
      })
      options.unshift({
        label: `自动`,
        description: null === previous ? '$(check)' : '',
        detail: `自动使用插件预期版本`,
        value: null
      })

      const result = await vscode.window.showQuickPick(options, {
        title: '切换 MaaFramework 版本(重启生效)'
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
      return value
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

    const result = await pacote.packument('@maaxyz/maa-node', {
      registry: this.registry,
      cache: this.cacheUri.fsPath
    })
    await release()
    return Object.entries(result.versions)
  }

  async fetchLatest() {
    let release = await this.lock()
    if (!release) {
      return null
    }

    const result = await pacote.manifest('@maaxyz/maa-node@latest', {
      registry: this.registry,
      cache: this.cacheUri.fsPath
    })
    await release()
    return result
  }

  async update() {
    const info = await this.fetchLatest()
    if (!info) {
      return false
    }
    return await this.prepare(info.version)
  }

  async prepare(version: string) {
    const release = await this.lock()
    if (!release) {
      return false
    }

    if (existsSync(this.versionFolder(version).fsPath)) {
      await release()
      return true
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification
      },
      async progress => {
        progress.report({
          message: '准备目录中'
        })
        const loaderTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'loader-').fsPath)
        const binaryTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'binary-').fsPath)
        progress.report({
          message: '下载 MaaFramework ${version} 脚本中',
          increment: 10
        })
        await pacote.extract(`@maaxyz/maa-node@${version}`, loaderTemp, {
          registry: this.registry,
          cache: this.cacheUri.fsPath
        })
        progress.report({
          message: '下载 MaaFramework ${version} 二进制中',
          increment: 40
        })
        await pacote.extract(
          `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
          binaryTemp,
          {
            registry: this.registry,
            cache: this.cacheUri.fsPath
          }
        )
        progress.report({
          message: '移动目录中',
          increment: 40
        })

        await fs.mkdir(
          vscode.Uri.joinPath(this.installUri, version, 'node_modules', '@maaxyz').fsPath,
          { recursive: true }
        )

        await fs.rename(
          loaderTemp,
          vscode.Uri.joinPath(this.installUri, version, 'node_modules', '@maaxyz', 'maa-node')
            .fsPath
        )
        await fs.rename(
          binaryTemp,
          vscode.Uri.joinPath(
            this.installUri,
            version,
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

  async load() {
    if (maa) {
      return true
    }

    if (!(await this.prepare(this.version))) {
      return false
    }

    module.paths.unshift(
      vscode.Uri.joinPath(this.versionFolder(this.version), 'node_modules').fsPath
    )

    try {
      setMaa(require('@maaxyz/maa-node'))
    } catch {
      return false
    }

    return true
  }
}
