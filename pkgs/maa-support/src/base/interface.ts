import { InputItemType, Interface, InterfaceRuntime } from '@maaxyz/maa-support-types'
import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import * as path from 'path'
import { v4 } from 'uuid'
import { URI as Uri } from 'vscode-uri'

import { getFileDialogImpl } from '@nekosu/native-dialog'

import { documentService, interfaceService, localStateService, lspService, rootService } from '.'
import { t } from '../locale'
import { handle } from '../server'
import { BaseService } from './base'

export class InterfaceService extends BaseService<{
  interfaceChanged: []
  resourcePathsChanged: []
}> {
  interfaceJson: Partial<Interface> = {}
  resourcePaths: string[] = []

  constructor() {
    super()

    rootService.emitter.on('activeRootInfoChanged', () => {
      this.loadInterface()
    })
    lspService.emitter.on('statusChanged', () => {
      this.loadInterface()
    })
    this.emitter.on('interfaceChanged', () => {
      this.fixConfig()
    })
  }

  listen() {
    handle('/interface/selectResource', async req => {
      await localStateService.reduce(state => {
        state.interfaceConfig!.resource = this.interfaceJson.resource?.[req.index].name
      })
      return {}
    })

    handle('/interface/selectController', async req => {
      await localStateService.reduce(state => {
        const ctrl = this.interfaceJson.controller?.[req.index].name
        state.interfaceConfig!.controller = ctrl
          ? {
              name: ctrl
            }
          : undefined
      })
      return {}
    })

    handle('/interface/configAdb', async req => {
      await localStateService.reduce(state => {
        state.interfaceConfig!.adb = {
          ...req
        }
      })
      return {}
    })

    handle('/interface/configDesktop', async req => {
      await localStateService.reduce(state => {
        state.interfaceConfig!.win32 = {
          ...req
        }
      })
      return {}
    })

    handle('/interface/configVscFixed', async req => {
      const file = await getFileDialogImpl().openFile({
        title: 'select image'
      })
      if (file && file.length > 0) {
        const target = path.join(localStateService.folder, 'fixed.png')
        await fs.copyFile(file[0], target)
        await localStateService.reduce(state => {
          state.interfaceConfig!.vscFixed = {
            image: target
          }
        })
      }
      return {}
    })

    handle('/interface/native/refreshAdb', async req => {
      return {
        devices: await maa.AdbController.find()
      }
    })

    handle('/interface/native/refreshDesktop', async req => {
      return {
        devices: await maa.Win32Controller.find()
      }
    })

    handle('/interface/addTask', async req => {
      await localStateService.reduce(state => {
        state.interfaceConfig!.task = state.interfaceConfig!.task ?? []
        state.interfaceConfig!.task.push({
          name: req.task,
          option: {},
          __vscKey: v4()
        })
      })
      return {}
    })

    handle('/interface/removeTask', async req => {
      await localStateService.reduce(state => {
        state.interfaceConfig!.task = state.interfaceConfig!.task?.filter(
          info => info.__vscKey !== req.key
        )
      })
      return {}
    })

    handle('/interface/configTask', async req => {
      await localStateService.reduce(state => {
        const task = state.interfaceConfig!.task?.find(info => info.__vscKey === req.key)
        if (!task) {
          return
        }
        task.option = task.option ?? {}
        task.option[req.option] = task.option[req.option] ?? {}
        const option = task.option[req.option]!
        if (typeof req.value === 'string') {
          option[req.name] = req.value
        } else {
          delete option[req.name]
        }
      })
      return {}
    })

    handle('/interface/buildRuntime', req => {
      const root = rootService.activeRootInfo
      const data = interfaceService.interfaceJson
      const config = localStateService.state.interfaceConfig
      if (!root || !data || !config) {
        return {
          error: 'no interface'
        }
      }

      const projectDir = root.folder
      const replaceVar = (x: string) => {
        return x.replaceAll('{PROJECT_DIR}', projectDir)
      }

      const result: Partial<InterfaceRuntime> = {}
      result.root = projectDir

      const ctrlInfo = data.controller?.find(info => info.name === config.controller?.name)
      if (!ctrlInfo) {
        return { error: t('maa.pi.error.cannot-find-controller', config.controller?.name ?? '') }
      }

      if (ctrlInfo.type === 'Adb') {
        if (!config.adb) {
          return {
            error: t('maa.pi.error.cannot-find-adb-for-controller', config.controller?.name ?? '')
          }
        }
        const adb_config = ctrlInfo.adb?.config ?? {}
        Object.assign(adb_config, config.adb?.config ?? {})

        result.controller_param = {
          ctype: 'adb',
          adb_path: config.adb.adb_path,
          address: config.adb.address,
          config: JSON.stringify(adb_config),
          screencap: ctrlInfo.adb?.screencap ?? maa.AdbScreencapMethod.Default,
          input: ctrlInfo.adb?.input ?? maa.AdbInputMethod.Default
        }
      } else if (ctrlInfo.type === 'Win32') {
        if (!config.win32) {
          return {
            error: t('maa.pi.error.cannot-find-win32-for-controller', config.controller?.name ?? '')
          }
        }
        if (!config.win32.hwnd) {
          return {
            error: t('maa.pi.error.cannot-find-hwnd-for-controller', config.controller?.name ?? '')
          }
        }

        result.controller_param = {
          ctype: 'win32',
          hwnd: config.win32.hwnd,
          screencap: ctrlInfo.win32?.screencap ?? maa.Win32ScreencapMethod.GDI,
          mouse: ctrlInfo.win32?.mouse ?? maa.Win32InputMethod.SendMessage,
          keyboard: ctrlInfo.win32?.keyboard ?? maa.Win32InputMethod.SendMessage
        }
      } else if (ctrlInfo.type === 'VscFixed') {
        if (!config.vscFixed) {
          return { error: 'No vscFixed for controller' }
        }
        if (!config.vscFixed.image) {
          return { error: 'No vscFixed image for controller' }
        }

        result.controller_param = {
          ctype: 'vscFixed',
          image: config.vscFixed.image
        }
      } else {
        return { error: '???' }
      }

      const resInfo = data.resource?.find(info => info.name === config.resource)
      if (!resInfo) {
        return { error: t('maa.pi.error.cannot-find-resource', config.resource ?? '') }
      }

      result.resource_path = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
        .map(replaceVar)
        .map(resPath => {
          return path.resolve(projectDir, resPath)
        })

      if (!req.skipTask) {
        result.task = []
        for (const task of config.task ?? []) {
          const taskInfo = data.task?.find(x => x.name === task.name)

          if (!taskInfo) {
            return { error: t('maa.pi.error.cannot-find-task', task.name) }
          }

          const params: unknown[] = [taskInfo.pipeline_override ?? {}]

          for (const optName of taskInfo.option ?? []) {
            const optInfo = data.option?.[optName]

            if (!optInfo) {
              return { error: t('maa.pi.error.cannot-find-option', optName) }
            }

            const optEntry = task.option?.[optName]

            if (!optInfo.type || optInfo.type === 'Select') {
              const optValue = optEntry?.default ?? optInfo.default_case ?? optInfo.cases?.[0].name

              const csInfo = optInfo.cases?.find(x => x.name === optValue)

              if (!csInfo) {
                return {
                  error: t(
                    'maa.pi.error.cannot-find-case-for-option',
                    optName,
                    optValue ?? '<unknown>'
                  )
                }
              }

              params.push(csInfo.pipeline_override ?? {})
            } else if (optInfo.type === 'Input') {
              const optValue = optEntry ?? {}
              for (const subOpt of optInfo.input ?? []) {
                if (!(subOpt.name in optValue)) {
                  optValue[subOpt.name] = subOpt.default ?? ''
                }
                if (subOpt.verify) {
                  const re = new RegExp(subOpt.verify)
                  if (!re.test(optValue[subOpt.name]!)) {
                    return { error: 'verify failed' }
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
                  for (const subOpt of optInfo.input ?? []) {
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
                  return { error: err }
                } else {
                  throw err
                }
              }
            }
          }

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

      return {
        runtime: result as InterfaceRuntime
      }
    })
  }

  async loadInterface() {
    this.interfaceJson = {}

    const root = rootService.activeRootInfo
    if (!root) {
      this.emitter.emit('interfaceChanged')
      return
    }

    const loadInterfaceImpl = async () => {
      const doc = await documentService.get(Uri.file(root.interface))
      if (!doc) {
        return false
      }
      try {
        this.interfaceJson = parse(doc.getText())
        return true
      } catch {
        return false
      }
    }

    const interfaceLoaded = await loadInterfaceImpl()
    this.emitter.emit('interfaceChanged')

    // TODO: fs watch
  }

  async fixConfig() {
    await localStateService.reduce(state => {
      let fixed = false
      if (!state.interfaceConfig) {
        fixed = true
        state.interfaceConfig = {}
      }

      const prevRes = this.interfaceJson.resource?.find(
        x => x.name === state.interfaceConfig?.resource
      )
      if (!prevRes && this.interfaceJson.resource) {
        fixed = true
        state.interfaceConfig.resource = this.interfaceJson.resource[0].name
      }

      let taskFixed = false
      const tasks = state.interfaceConfig.task ?? []
      const fixedTasks = tasks.map(task => {
        const newTask = {
          ...task
        }
        if (!newTask.__vscKey) {
          fixed = true
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
        fixed = true
        state.interfaceConfig.task = fixedTasks
      }

      if (fixed) {
        this.updateResource()
      }
    })
  }

  async updateResource() {
    const resInfo = this.interfaceJson.resource?.find(
      x => x.name === localStateService.state.interfaceConfig?.resource
    )
    const rootPath = rootService.activeRootInfo?.folder
    if (!resInfo || !rootPath) {
      this.resourcePaths = []
    } else {
      this.resourcePaths = (typeof resInfo.path === 'string' ? [resInfo.path] : resInfo.path)
        .map(x => x.replace('{PROJECT_DIR}', rootPath))
        .map(x => path.resolve(x)) // 移除路径结尾的sep, 防止后续比较的时候加多了
    }
    this.emitter.emit('resourcePathsChanged')
  }
}
