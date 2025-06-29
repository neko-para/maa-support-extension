import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import pacote from 'pacote'
import { lock } from 'proper-lockfile'
import * as vscode from 'vscode'

import { maa, setMaa } from '../maa'
import { BaseService, context } from './context'

const registries = {
  main: 'https://registry.npmjs.org',
  taobao: 'https://registry.npm.taobao.org'
}

function isValidRegistryType(key: unknown): key is keyof typeof registries {
  return typeof key === 'string' && ['main', 'taobao'].includes(key)
}

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

    const registryType = context.globalState.get('NativeService:registry')
    if (isValidRegistryType(registryType)) {
      this.registry = registries[registryType]
    } else {
      this.registry = registries.main
    }

    const explicitVersion = context.globalState.get('NativeService:version')
    if (typeof explicitVersion === 'string') {
      this.version = explicitVersion
    } else {
      this.version = '4.4.0-beta.1'
    }

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

    const loaderTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'loader-').fsPath)
    const binaryTemp = await fs.mkdtemp(vscode.Uri.joinPath(this.downloadUri, 'binary-').fsPath)
    await pacote.extract(`@maaxyz/maa-node@${version}`, loaderTemp, {
      registry: this.registry,
      cache: this.cacheUri.fsPath
    })
    await pacote.extract(
      `@maaxyz/maa-node-${process.platform}-${process.arch}@${version}`,
      binaryTemp,
      {
        registry: this.registry,
        cache: this.cacheUri.fsPath
      }
    )

    await fs.mkdir(
      vscode.Uri.joinPath(this.installUri, version, 'node_modules', '@maaxyz').fsPath,
      { recursive: true }
    )

    await fs.rename(
      loaderTemp,
      vscode.Uri.joinPath(this.installUri, version, 'node_modules', '@maaxyz', 'maa-node').fsPath
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

    setMaa(require('@maaxyz/maa-node'))

    return true
  }
}
