import * as vscode from 'vscode'

import { logger, t } from '@mse/utils'

import { interfaceService, launchService, rootService, taskIndexService } from '.'
import { commands } from '../command'
import { BaseService } from './context'
import { TaskIndexInfo } from './types'
import { WebviewCropPanel } from './webview/crop'

export class CommandService extends BaseService {
  constructor() {
    super()
    console.log('construct CommandService')

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      const runtime = interfaceService.buildRuntime()
      if (typeof runtime === 'string') {
        vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
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
        vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
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

    this.defer = vscode.commands.registerCommand(commands.OpenCrop, () => {
      new WebviewCropPanel('Maa Crop').init()
    })

    this.defer = vscode.commands.registerCommand(commands.GotoTask, async (task?: string) => {
      if (!task) {
        const taskList = await taskIndexService.queryTaskList()
        task = await vscode.window.showQuickPick(taskList)
      }
      if (task) {
        const infos = await taskIndexService.queryTask(task)
        let info: TaskIndexInfo
        if (infos.length > 1) {
          const res = await vscode.window.showQuickPick(
            infos.map((info, index) => ({
              label: rootService.relativePathToRoot(info.info.uri),
              index: index
            }))
          )
          if (!res) {
            return
          }
          info = infos[res.index].info
        } else if (infos.length === 1) {
          info = infos[0].info
        } else {
          return
        }
        try {
          const doc = await vscode.workspace.openTextDocument(info.uri)
          const editor = await vscode.window.showTextDocument(doc)
          const targetSelection = new vscode.Selection(info.taskBody.start, info.taskBody.end)
          editor.selection = targetSelection
          editor.revealRange(targetSelection)
        } catch {}
      }
    })
  }

  async init() {
    console.log('init CommandService')
  }
}
