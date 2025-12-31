import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import path from 'path'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import {
  InputItemType,
  Interface,
  InterfaceConfig,
  InterfaceRuntime,
  SelectOption,
  SwitchOption
} from '@mse/types'
import { logger, t } from '@mse/utils'

import { launchService, rootService } from '.'
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
      } catch {}

      const fixConfig: Partial<InterfaceConfig> = {}

      let resFixed = false
      const prevRes = this.interfaceJson.resource?.find(
        x => x.name === this.interfaceConfigJson.resource
      )
      if (!prevRes && this.interfaceJson.resource) {
        resFixed = true
        fixConfig.resource = this.interfaceJson.resource[0].name
      }

      let taskFixed = false
      const tasks = this.interfaceConfigJson.task ?? []
      const fixedTasks = tasks.map(task => {
        const newTask = {
          ...task
        }
        if (!newTask.__vscKey) {
          taskFixed = true
          newTask.__vscKey = v4()
        }
        if (Array.isArray(newTask.option)) {
          const newOptions: Record<string, Record<string, string>> = {}
          for (const { name, value } of newTask.option as { name: string; value: string }[]) {
            newOptions[name] = {
              default: value
            }
          }
          taskFixed = true
          newTask.option = newOptions
        }
        return newTask
      })
      if (taskFixed) {
        fixConfig.task = fixedTasks
      }

      if (resFixed || taskFixed) {
        setTimeout(() => {
          this.reduceConfig(fixConfig)
        }, 0)
      } else {
        setTimeout(() => {
          this.interfaceConfigChanged.fire()
        }, 0)
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
        .map(x => path.resolve(rootPath, x)) // 移除路径结尾的sep, 防止后续比较的时候加多了
        .map(x => vscode.Uri.file(x))
    }
    this.resourceChanged.fire()
  }

  suggestResource() {
    return this.resourcePaths.length > 0 ? this.resourcePaths[this.resourcePaths.length - 1] : null
  }

  resolveRelative(uri: vscode.Uri) {
    for (const res of this.resourcePaths) {
      if (uri.fsPath.startsWith(res.fsPath)) {
        return uri.fsPath.replace(res.fsPath, '')
      }
    }
    return null
  }

  shouldFilter(uri: vscode.Uri) {
    const fileName = path.basename(uri.fsPath)
    if (fileName === 'interface.json' || fileName === 'interface.jsonc') {
      return false
    }
    const rel = this.resolveRelative(uri)
    if (rel) {
      const segs = rel.split(/[\/\\]+/)
      return !!segs.find(x => x.startsWith('.'))
    }
    return true
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

    const ctrlRt = launchService.buildControllerRuntime()
    if (!ctrlRt) {
      return '构建controller失败'
    }
    result.controller_param = ctrlRt

    const resInfo = data.resource?.find(info => info.name === config.resource)
    if (!resInfo) {
      return t('maa.pi.error.cannot-find-resource', config.resource ?? '')
    }

    result.resource_path = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
      .map(replaceVar)
      .map(resPath => {
        return path.resolve(projectDir, resPath)
      })

    if (!skipTask) {
      result.task = []
      for (const task of config.task ?? []) {
        const taskInfo = data.task?.find(x => x.name === task.name)

        if (!taskInfo) {
          return t('maa.pi.error.cannot-find-task', task.name)
        }

        const getAllOption = () => {
          const resolved: string[] = []
          const options = [...(taskInfo.option ?? [])]
          while (options.length > 0) {
            const opt = options.shift()!
            if (resolved.indexOf(opt) !== -1) {
              continue
            }
            resolved.push(opt)

            const optMeta = data.option?.[opt]
            if (!optMeta) {
              continue
            }
            if ((optMeta.type ?? 'select') === 'select') {
              const selectMeta = optMeta as SelectOption

              let optValue = task.option?.[opt]?.default
              if (typeof optValue === 'object') {
                optValue = undefined
              }
              const val = optValue ?? selectMeta.default_case ?? selectMeta.cases?.[0].name
              if (val) {
                const caseMeta = selectMeta.cases?.find(cs => cs.name === val)
                if (caseMeta?.option) {
                  options.push(...caseMeta.option)
                }
              }
            } else if (optMeta.type === 'switch') {
              const switchMeta = optMeta as SwitchOption

              let optValue = task.option?.[opt]?.default
              if (typeof optValue === 'object') {
                optValue = undefined
              }
              const val = optValue ?? switchMeta.default_case ?? switchMeta.cases?.[0].name
              if (val) {
                const caseMeta = switchMeta.cases?.find(cs => cs.name === val)
                if (caseMeta?.option) {
                  options.push(...caseMeta.option)
                }
              }
            }
          }
          return resolved
        }

        const params: unknown[] = [taskInfo.pipeline_override ?? {}]

        for (const optName of getAllOption()) {
          const optInfo = data.option?.[optName]

          if (!optInfo) {
            return t('maa.pi.error.cannot-find-option', optName)
          }

          const optEntry = task.option?.[optName]

          if (!optInfo.type || optInfo.type === 'select' || optInfo.type === 'switch') {
            const optValue = optEntry?.default ?? optInfo.default_case ?? optInfo.cases?.[0].name

            const csInfo = optInfo.cases?.find(x => x.name === optValue)

            if (!csInfo) {
              return t('maa.pi.error.cannot-find-case-for-option', optName, optValue ?? '<unknown>')
            }

            params.push(csInfo.pipeline_override ?? {})
          } else if (optInfo.type === 'input') {
            const optValue = optEntry ?? {}
            for (const subOpt of optInfo.inputs ?? []) {
              if (!(subOpt.name in optValue)) {
                optValue[subOpt.name] = subOpt.default ?? ''
              }
              if (subOpt.verify) {
                const re = new RegExp(subOpt.verify)
                if (!re.test(optValue[subOpt.name]!)) {
                  return 'verify failed'
                }
              }
            }

            const templateOverride = optInfo.pipeline_override ?? {}

            const updateOverride = (v: unknown): unknown => {
              if (Array.isArray(v)) {
                return v.map(updateOverride)
              } else if (typeof v === 'object' && v !== null) {
                const obj = v as Record<string, unknown>
                return Object.fromEntries(
                  Object.entries(obj).map(([key, val]) => {
                    return [key, updateOverride(val)] as [string, unknown]
                  })
                )
              } else if (typeof v === 'string') {
                let finalType: InputItemType | undefined = undefined
                let result = v
                for (const subOpt of optInfo.inputs ?? []) {
                  const idx = result.indexOf(`{${subOpt.name}}`)
                  if (idx !== -1) {
                    const expectType = subOpt.pipeline_type ?? 'string'
                    if (finalType && finalType !== expectType) {
                      throw 'input type mismatch!'
                    }
                    finalType = expectType
                    result = result.replaceAll(`{${subOpt.name}}`, optValue[subOpt.name]!)
                  }
                }
                switch (finalType) {
                  case 'string':
                    return result
                  case 'int':
                    return parseInt(result)
                }
                return ''
              } else {
                return v
              }
            }

            try {
              params.push(updateOverride(templateOverride))
            } catch (err) {
              if (typeof err === 'string') {
                return err
              } else {
                throw err
              }
            }
          }
        }

        logger.debug(`${task.name} ${taskInfo.entry} ${JSON.stringify(params)}`)

        result.task.push({
          name: task.name,
          entry: taskInfo.entry,
          pipeline_override: params
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
