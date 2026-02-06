import semVerCompare from 'semver/functions/compare'
import * as vscode from 'vscode'

import { t } from '@mse/locale'
import { MaaVersionManager, NpmRegistryType } from '@mse/maa-version-manager'

import { serverService } from '.'
import packageJson from '../../package.json'
import { commands } from '../command'
import { BaseService, context } from './context'
import { makePromise } from './utils/promise'

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

  prepared: boolean

  manager: MaaVersionManager

  versionChanged = new vscode.EventEmitter<void>()
  get onVersionChanged() {
    return this.versionChanged.event
  }

  constructor() {
    super()
    console.log('construct NativeService')

    this.registry = MaaVersionManager.registries[this.registryType ?? defaultRegistryType]
    this.version = this.explicitVersion ?? defaultMaaVersion

    this.prepared = false

    this.manager = new MaaVersionManager(
      vscode.Uri.joinPath(context.globalStorageUri, 'native').fsPath
    )
  }

  async init() {
    console.log('init NativeService')

    await this.manager.init()

    this.defer = vscode.commands.registerCommand(commands.NativeSelectRegistry, async () => {
      let previous = this.registryType

      const options: (vscode.QuickPickItem & { value: NpmRegistryType | null })[] = Object.keys(
        MaaVersionManager.registries
      )
        .filter(MaaVersionManager.isValidRegistryType)
        .map(type => {
          const descTags: string[] = []
          if (this.registry === MaaVersionManager.registries[type]) {
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
            detail: MaaVersionManager.registries[type],
            value: type
          }
        })

      const result = await vscode.window.showQuickPick(options, {
        title: t('maa.native.switch-mirror')
      })
      if (result) {
        this.registryType = result.value
        this.registry = MaaVersionManager.registries[this.registryType ?? defaultRegistryType]
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
          allLocal = await this.manager.fetchAllLocalVersions()
          allRemote = (await this.manager.fetchAllVersions(minimumMaaVersion)).map(x => x[0])
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
        this.version = this.explicitVersion ?? defaultMaaVersion

        serverService.kill()
        this.prepared = false

        this.versionChanged.fire()
      }
    })
  }

  get registryType() {
    const value = context.globalState.get('NativeService:registry')
    return MaaVersionManager.isValidRegistryType(value) ? value : null
  }

  set registryType(value: NpmRegistryType | null) {
    if (value && MaaVersionManager.isValidRegistryType(value)) {
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

  async prepare(version: string) {
    let progressInst: vscode.Progress<{
      message?: string
      increment?: number
    }> | null = null
    let progressFinish: () => void = () => {}
    return await this.manager.prepare(version, progress => {
      switch (progress) {
        case 'prepare-folder':
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification
            },
            async progress => {
              progressInst = progress

              progressInst.report({
                message: t('maa.native.download.preparing-folder')
              })

              const [promise, resolve] = makePromise<void>()
              progressFinish = resolve
              await promise
            }
          )
          break
        case 'download-scripts':
          progressInst?.report({
            message: t('maa.native.download.downloading-scripts', version),
            increment: 10
          })
          break
        case 'download-binary':
          progressInst?.report({
            message: t('maa.native.download.downloading-binary', version),
            increment: 40
          })
          break
        case 'move-folders':
          progressInst?.report({
            message: t('maa.native.download.moving-folder'),
            increment: 40
          })
          break
        case 'finish':
          progressInst?.report({
            increment: 10
          })
          progressFinish()
          break
      }
    })
  }

  get activeModulePath() {
    return this.manager.moduleFolder(this.version)
  }

  async load() {
    if (this.prepared) {
      return true
    }

    if (!(await this.prepare(this.version))) {
      return false
    }

    this.cleanUnused()
    this.prepared = true

    this.versionChanged.fire()

    return true
  }

  async cleanUnused() {
    await this.manager.cleanUnused([this.version])
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
