import * as vscode from 'vscode'

import { TaskDeclInfo } from '@mse/pipeline-manager'
import { t } from '@mse/utils'
import { MaaTaskExpr, TaskExprProps, TaskExprPropsVirtsMap, shouldStrip } from '@nekosu/maa-tasker'

import { interfaceService, launchService, rootService, serverService, stateService } from '.'
import { commands } from '../command'
import { isMaaAssistantArknights } from '../utils/fs'
import { BaseService } from './context'
import { convertRange } from './language/utils'
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
        await interfaceService.interfaceBundle?.flush()
        const taskList = interfaceService.interfaceBundle?.topLayer?.getTaskList() ?? []
        const taskRes = await vscode.window.showQuickPick(taskList, {
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
          pipeline_override: []
        }
      ])
      return true
    })

    this.defer = vscode.commands.registerCommand(commands.PISwitchResource, resource => {
      interfaceService.reduceConfig({
        resource
      })
    })

    this.defer = vscode.commands.registerCommand(commands.PISwitchLocale, locale => {
      interfaceService.reduceConfig({
        locale
      })
    })

    this.defer = vscode.commands.registerCommand(commands.OpenCrop, async () => {
      const ipc = await serverService.ensureServer()
      if (ipc) {
        new WebviewCropPanel(ipc, 'Maa Crop').init()
      }
    })

    this.defer = vscode.commands.registerCommand(commands.GotoTask, async (task?: string) => {
      await interfaceService.interfaceBundle?.flush()
      const topLayer = interfaceService.interfaceBundle?.topLayer
      if (!topLayer) {
        return
      }
      if (!task) {
        const taskList = topLayer.getTaskList()
        task = await vscode.window.showQuickPick(taskList)
      }
      if (task) {
        const decls = topLayer.mergedAllDecls.filter(
          decl => decl.type === 'task.decl' && decl.task === task
        )
        let info: TaskDeclInfo
        if (decls.length > 1) {
          const res = await vscode.window.showQuickPick(
            decls.map((decl, index) => ({
              label: rootService.relativeToRoot(decl.file),
              index: index
            }))
          )
          if (!res) {
            return
          }
          info = decls[res.index]
        } else if (decls.length === 1) {
          info = decls[0]
        } else {
          return
        }
        try {
          const doc = await vscode.workspace.openTextDocument(info.file)
          const editor = await vscode.window.showTextDocument(doc)
          const range = convertRange(doc, info.location)
          const targetSelection = new vscode.Selection(range.start, range.end)
          editor.selection = targetSelection
          editor.revealRange(targetSelection)
        } catch {}
      }
    })

    this.defer = vscode.commands.registerCommand(commands.EvalTask, async (task?: string) => {
      if (
        !isMaaAssistantArknights ||
        typeof task !== 'string' ||
        !interfaceService.interfaceBundle
      ) {
        vscode.window.showErrorMessage(t('maa.eval.eval-failed'))
        return false
      }

      const intBundle = interfaceService.interfaceBundle
      await intBundle.flush(true)

      const result = intBundle.maaEvalTask(task)
      if (!result) {
        vscode.window.showErrorMessage(t('maa.eval.eval-failed'))
        return false
      }

      const originalExpr: Partial<Record<string, string>> = {}
      if (stateService.state.evalTaskConfig?.expandList) {
        for (const prop of TaskExprProps) {
          if (prop in result.task) {
            const list = result.task[prop]!
            originalExpr[prop] = JSON.stringify(list)

            const listResult: string[] = []
            for (const expr of list) {
              const exprResult = intBundle.maaEvalExpr(
                expr,
                task,
                shouldStrip(TaskExprPropsVirtsMap[prop])
              )
              if (!exprResult) {
                vscode.window.showErrorMessage(t('maa.eval.eval-failed'))
                return false
              }
              listResult.push(...exprResult)
            }
            result.task[prop] = listResult as MaaTaskExpr[]
          }
        }
      }

      let content = JSON.stringify(result.task, null, 4)
      for (const [key, info] of Object.entries(result.trace)) {
        content = content.replace(
          `    "${key}"`,
          `\n    // ${info.task} (${info.anchor})\n    "${key}"`
        )
        if (key in originalExpr) {
          content = content.replace(
            `    "${key}"`,
            `    // ${t('maa.eval.json.expanded-from')} ${originalExpr[key]}\n    "${key}"`
          )
        }
      }
      content = content.replace('{\n\n', '{\n')

      const doc = await vscode.workspace.openTextDocument({
        language: 'jsonc',
        content: `// ${t('maa.eval.json.eval-task')} ${task}\n// ${result.self.task} (${result.self.anchor})\n${content}`
      })
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two)
      return true
    })

    this.defer = vscode.commands.registerCommand(
      commands.EvalExpr,
      async (expr?: string, host?: string, strip?: boolean) => {
        if (
          !isMaaAssistantArknights ||
          typeof expr !== 'string' ||
          typeof host !== 'string' ||
          typeof strip !== 'boolean' ||
          !interfaceService.interfaceBundle
        ) {
          vscode.window.showErrorMessage(t('maa.eval.eval-failed'))
          return false
        }

        const intBundle = interfaceService.interfaceBundle
        await intBundle.flush(true)

        const result = intBundle.maaEvalExpr(expr as MaaTaskExpr, host, strip)
        if (!result) {
          vscode.window.showErrorMessage(t('maa.eval.eval-failed'))
          return false
        }

        const doc = await vscode.workspace.openTextDocument({
          language: 'jsonc',
          content: `// ${t('maa.eval.json.eval-list')} ${host}: ${expr}${strip ? ` [${t('maa.eval.json.stripped')}]` : ''}\n${JSON.stringify(result, null, 4)}`
        })
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two)
        return true
      }
    )

    this.defer = vscode.commands.registerCommand(commands.TriggerCompletion, () => {
      setTimeout(() => {
        vscode.commands.executeCommand('editor.action.triggerSuggest')
      }, 50)
    })
  }

  async init() {
    console.log('init CommandService')
  }
}
