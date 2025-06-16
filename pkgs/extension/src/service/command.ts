import * as vscode from 'vscode'

import { logger, t } from '@mse/utils'

import { interfaceService, launchService, taskIndexService } from '.'
import { commands } from '../command'
import { BaseService } from './context'

export class CommandService extends BaseService {
  constructor() {
    super()
    console.log('construct CommandService')

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      const runtime = interfaceService.buildRuntime()
      if (typeof runtime === 'string') {
        vscode.window.showErrorMessage(`生成配置失败: ${runtime}`)
        return false
      }
      launchService.launchRuntime(runtime)
      return true
    })

    this.defer = vscode.commands.registerCommand(commands.LaunchTask, async (task?: string) => {
      if (!task) {
        const taskRes = await vscode.window.showQuickPick(await taskIndexService.queryTaskList(), {
          title: t('maa.pi.title.select-task')
        })
        if (!taskRes) {
          return false
        }
        task = taskRes
      }

      const runtime = interfaceService.buildRuntime(true)
      if (typeof runtime === 'string') {
        vscode.window.showErrorMessage(`生成配置失败: ${runtime}`)
        return false
      }
      launchService.launchRuntime(runtime, [
        {
          name: task,
          entry: task,
          pipeline_override: {}
        }
      ])
      return true
    })

    this.defer = vscode.commands.registerCommand(commands.PISwitchResource, resource => {
      interfaceService.reduceConfig({
        resource
      })
    })
  }

  async init() {
    console.log('init CommandService')
  }
}
