import { Interface } from '@maaxyz/maa-support-types'
import * as fs from 'fs/promises'
import { parse } from 'jsonc-parser'
import * as path from 'path'
import { v4 } from 'uuid'
import { URI as Uri } from 'vscode-uri'

import { getFileDialogImpl } from '@nekosu/native-dialog'

import { documentService, localStateService, lspService, rootService } from '.'
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
