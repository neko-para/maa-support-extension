import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import path from 'path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { Interface, InterfaceConfig, InterfaceRuntime } from '@mse/types'
import { t } from '@mse/utils'

import { rootService } from '.'
import { maa } from '../maa'
import { currentWorkspace } from '../utils/fs'
import { BaseService } from './context'

export class InterfaceService extends BaseService {
  interfaceJson: Partial<Interface> = {}
  interfaceConfigJson: Partial<InterfaceConfig> = {}

  resourcePaths: vscode.Uri[] = []

  watchInterface?: vscode.Disposable

  interfaceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceChanged() {
    return this.interfaceChanged.event
  }

  interfaceConfigChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onInterfaceConfigChanged() {
    return this.interfaceConfigChanged.event
  }

  resourceChanged: vscode.EventEmitter<void> = new vscode.EventEmitter()
  get onResourceChanged() {
    return this.resourceChanged.event
  }

  constructor() {
    super()
    console.log('construct InterfaceService')

    this.defer = this.interfaceChanged
    this.defer = this.resourceChanged

    this.defer = {
      dispose: () => {
        this.watchInterface?.dispose()
      }
    }

    this.defer = rootService.onActiveResourceChanged(() => {
      this.loadInterface()
    })

    this.defer = this.onInterfaceChanged(() => {
      this.updateResource()
    })

    this.defer = this.onInterfaceConfigChanged(() => {
      this.updateResource()
    })
  }

  async init() {
    console.log('init InterfaceService')
  }

  async loadInterface() {
    this.watchInterface?.dispose()

    this.interfaceJson = {}
    this.interfaceConfigJson = {}

    const root = rootService.activeResource
    if (!root) {
      return
    }

    const doLoadInterface = async () => {
      try {
        const doc = await vscode.workspace.openTextDocument(root.interfaceUri)
        this.interfaceJson = parse(doc.getText())
        setTimeout(() => {
          this.interfaceChanged.fire()
        }, 0)
      } catch {
        this.interfaceChanged.fire()
      }
    }

    const doLoadInterfaceConfig = async () => {
      try {
        const doc = await vscode.workspace.openTextDocument(root.configUri)
        this.interfaceConfigJson = parse(doc.getText())

        let fixed = false
        const tasks = this.interfaceConfigJson.task ?? []
        const fixedTasks = tasks.map(task => {
          if (!task.__vscKey) {
            fixed = true
            return {
              ...task,
              __vscKey: v4()
            }
          } else {
            return task
          }
        })
        if (fixed) {
          setTimeout(() => {
            this.reduceConfig({
              task: fixedTasks
            })
          }, 0)
        } else {
          setTimeout(() => {
            this.interfaceConfigChanged.fire()
          }, 0)
        }
      } catch {
        this.interfaceConfigChanged.fire()
      }
    }

    this.watchInterface = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.fsPath === root.interfaceUri.fsPath) {
        doLoadInterface()
      } else if (event.document.uri.fsPath === root.configUri.fsPath) {
        doLoadInterfaceConfig()
      }
    })

    await doLoadInterface()
    await doLoadInterfaceConfig()
  }

  async saveInterfaceConfig() {
    const root = rootService.activeResource
    if (!root) {
      return
    }

    const configPath = root.configUri.fsPath
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(this.interfaceConfigJson, null, 4))
  }

  async reduceConfig(config?: Partial<InterfaceConfig>) {
    this.interfaceConfigJson = {
      ...this.interfaceConfigJson,
      ...config
    }
    await this.saveInterfaceConfig()
    this.interfaceConfigChanged.fire()
  }

  updateResource() {
    const resInfo = this.interfaceJson.resource?.find(
      x => x.name === this.interfaceConfigJson?.resource
    )
    const rootPath = rootService.activeResource?.dirUri.fsPath
    if (!resInfo || !rootPath) {
      this.resourcePaths = []
    } else {
      this.resourcePaths = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
        .map(x => x.replace('{PROJECT_DIR}', rootPath))
        .map(x => path.resolve(x)) // 移除路径结尾的sep, 防止后续比较的时候加多了
        .map(x => vscode.Uri.file(x))
    }
    this.resourceChanged.fire()
  }

  suggestResource() {
    return this.resourcePaths.length > 0 ? this.resourcePaths[this.resourcePaths.length - 1] : null
  }

  buildRuntime(skipTask = false) {
    if (!rootService.activeResource) {
      return '无interface'
    }
    const projectDir = vscode.Uri.joinPath(
      currentWorkspace()!,
      rootService.activeResource.dirRelative
    ).fsPath

    const replaceVar = (x: string) => {
      return x.replaceAll('{PROJECT_DIR}', projectDir)
    }

    const data = this.interfaceJson
    const config = this.interfaceConfigJson

    const result: Partial<InterfaceRuntime> = {}

    result.root = projectDir

    const ctrlInfo = data.controller?.find(info => info.name === config.controller?.name)
    if (!ctrlInfo) {
      return t('maa.pi.error.cannot-find-controller', config.controller?.name ?? '')
    }

    if (ctrlInfo.type === 'Adb') {
      if (!config.adb) {
        return t('maa.pi.error.cannot-find-adb-for-controller', config.controller?.name ?? '')
      }
      const adb_config = ctrlInfo.adb?.config ?? {}
      Object.assign(adb_config, config.adb?.config ?? {})

      result.controller_param = {
        ctype: 'adb',
        adb_path: config.adb.adb_path,
        address: config.adb.address,
        config: JSON.stringify(adb_config),
        screencap: ctrlInfo.adb?.screencap ?? maa.api.AdbScreencapMethod.Default,
        input: ctrlInfo.adb?.input ?? maa.api.AdbInputMethod.Default
      }
    } else if (ctrlInfo.type === 'Win32') {
      if (!config.win32) {
        return t('maa.pi.error.cannot-find-win32-for-controller', config.controller?.name ?? '')
      }
      if (!config.win32.hwnd) {
        return t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller?.name ?? '')
      }

      result.controller_param = {
        ctype: 'win32',
        hwnd: config.win32.hwnd,
        screencap: ctrlInfo.win32?.screencap ?? maa.api.Win32ScreencapMethod.GDI,
        input: ctrlInfo.win32?.input ?? maa.api.Win32InputMethod.SendMessage
      }
    } else {
      return '???'
    }

    const resInfo = data.resource?.find(info => info.name === config.resource)
    if (!resInfo) {
      return t('maa.pi.error.cannot-find-resource', config.resource ?? '')
    }

    result.resource_path = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path).map(
      replaceVar
    )

    if (!skipTask) {
      result.task = []
      for (const task of config.task ?? []) {
        const taskInfo = data.task?.find(x => x.name === task.name)

        if (!taskInfo) {
          return t('maa.pi.error.cannot-find-task', task.name)
        }

        const param: Record<string, unknown> = {}

        const mergeParam = (data?: unknown) => {
          for (const [task, opt] of Object.entries((data as Record<string, unknown>) ?? {})) {
            param[task] = Object.assign(param[task] ?? {}, opt)
          }
        }

        mergeParam(taskInfo.pipeline_override)

        for (const optName of taskInfo.option ?? []) {
          const optInfo = data.option?.[optName]

          if (!optInfo) {
            return t('maa.pi.error.cannot-find-option', optName)
          }

          const optEntry = task.option?.find(x => x.name === optName)

          const optValue = optEntry?.value ?? optInfo.default_case ?? optInfo.cases[0].name

          const csInfo = optInfo.cases.find(x => x.name === optValue)

          if (!csInfo) {
            return t('maa.pi.error.cannot-find-case-for-option', optName, optValue)
          }

          mergeParam(csInfo.pipeline_override)
        }

        result.task.push({
          name: task.name,
          entry: taskInfo.entry,
          pipeline_override: param
        })
      }
    }

    if (data.agent) {
      result.agent = {
        child_exec: data.agent.child_exec ? replaceVar(data.agent.child_exec) : undefined,
        child_args: data.agent.child_args?.map(replaceVar),
        identifier: data.agent.identifier
      }
    }

    return result as InterfaceRuntime
  }
}
