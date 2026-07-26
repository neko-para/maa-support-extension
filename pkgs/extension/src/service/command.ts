import * as vscode from 'vscode'

import { logger } from '@mse/utils'
import { t } from '@nekosu/maa-locale'
import { type TaskDeclInfo, extractTaskRef } from '@nekosu/maa-pipeline-manager'
import {
  type MaaTaskExpr,
  TaskExprProps,
  TaskExprPropsVirtsMap,
  shouldStrip
} from '@nekosu/maa-tasker'

import {
  interfaceService,
  launchService,
  rootService,
  serverService,
  shortcutService,
  stateService
} from '.'
import { commands } from '../command'
import { isMaaAssistantArknights } from '../utils/fs'
import { BaseService } from './context'
import { autoConvertRangeLocation, convertRange } from './language/utils'
import type { ShortcutCommand } from './shortcut'
import { toPngDataUrl } from './utils/png'
import { type OpenCropPayload, type OpenCropResult, openCropPanel } from './webview/crop'

export class CommandService extends BaseService {
  constructor() {
    super()
    console.log('construct CommandService')

    this.defer = vscode.commands.registerCommand(commands.LaunchInterface, async () => {
      const runtime = await interfaceService.buildRuntime()
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
        const taskList = interfaceService.interfaceBundle?.topLayer.getTaskList() ?? []
        const taskRes = await vscode.window.showQuickPick(taskList, {
          title: t('maa.pi.title.select-task')
        })
        if (!taskRes) {
          return false
        }
        task = taskRes
      }

      const runtime = await interfaceService.buildRuntime(true)
      if (typeof runtime === 'string') {
        vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
        return false
      }
      launchService.launchRuntime(runtime, {
        tasks: [
          {
            name: task,
            entry: task,
            pipeline_override: []
          }
        ]
      })
      return true
    })

    this.defer = vscode.commands.registerCommand(commands.Start, () => this.routeShortcut('start'))
    this.defer = vscode.commands.registerCommand(commands.TogglePause, () =>
      this.routeShortcut('toggle-pause')
    )
    this.defer = vscode.commands.registerCommand(commands.Stop, () => this.routeShortcut('stop'))
    this.defer = vscode.commands.registerCommand(commands.Screencap, () =>
      this.routeShortcut('screencap')
    )

    shortcutService.setCommandHandler(command => this.executeShortcut(command))

    this.defer = vscode.commands.registerCommand(
      commands.FindTaskRef,
      async (task?: string, uri?: vscode.Uri, pos?: vscode.Position) => {
        if (!task || !uri || !pos) {
          return false
        }

        const refs =
          interfaceService.interfaceBundle?.topLayer.mergedAllRefs.filter(
            ref => extractTaskRef(ref) === task
          ) ?? []
        const locs = await Promise.all(refs.map(autoConvertRangeLocation))

        await vscode.commands.executeCommand('editor.action.showReferences', uri, pos, locs)

        return true
      }
    )

    this.defer = vscode.commands.registerCommand(commands.PISwitchResource, resource => {
      interfaceService.reduceConfig({
        resource
      })
    })

    this.defer = vscode.commands.registerCommand(commands.PISwitchLocale, locale => {
      interfaceService.reduceConfig({
        __locale: locale
      })
    })

    this.defer = vscode.commands.registerCommand(
      commands.OpenCrop,
      async (payload?: OpenCropPayload | vscode.Uri): Promise<OpenCropResult | undefined> => {
        if (payload && 'fsPath' in payload) {
          payload = {
            image: toPngDataUrl(await vscode.workspace.fs.readFile(payload))
          }
        }

        const ipc = await serverService.ensureServer()
        if (ipc) {
          await openCropPanel(ipc, payload)
          return {
            opened: true,
            imageAccepted: typeof payload?.image === 'string' && payload.image.trim().length > 0,
            detailAccepted: !!payload?.detail && typeof payload.detail === 'object'
          }
        }
      }
    )

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
        } catch (err) {
          logger.error(`${err}`)
        }
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

  private async routeShortcut(command: ShortcutCommand) {
    const route = await shortcutService.route(command)
    if (route === 'local') {
      await this.executeShortcut(command)
      return true
    }
    if (route === 'forwarded') {
      return true
    }

    vscode.window.showWarningMessage(t('maa.shortcut.no-target'))
    return false
  }

  private async executeShortcut(command: ShortcutCommand) {
    switch (command) {
      case 'start': {
        if (!rootService.activeResource) {
          await rootService.refresh()
        }
        const runtime = await interfaceService.buildRuntime()
        if (typeof runtime === 'string') {
          vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
          return
        }
        void launchService.launchRuntime(runtime, undefined, {
          revealLog: false,
          preserveFocus: true
        })
        return
      }
      case 'toggle-pause': {
        const panels = this.requireActivePanels()
        if (panels) {
          const shouldPause = panels.some(panel => !panel.paused)
          panels.forEach(panel => (shouldPause ? panel.pause() : panel.cont()))
        }
        return
      }
      case 'stop': {
        const panels = this.requireActivePanels()
        if (panels) {
          await Promise.all(panels.map(panel => panel.stop()))
        }
        return
      }
      case 'screencap':
        await this.takeScreencap()
        return
    }
  }

  private activePanels() {
    return Object.values(serverService.instMap).filter(panel => !panel.stopped)
  }

  private requireActivePanels() {
    const panels = this.activePanels()
    if (panels.length === 0) {
      vscode.window.showWarningMessage(t('maa.shortcut.no-instances'))
      return null
    }
    return panels
  }

  private async takeScreencap() {
    try {
      const activeInstances = Object.entries(serverService.instMap).filter(
        ([, panel]) => !panel.stopped
      )

      let instance: string | undefined
      let runtimeRoot: vscode.Uri
      if (activeInstances.length > 0) {
        const roots = new Set(
          activeInstances.map(([, panel]) =>
            process.platform === 'win32' ? panel.runtimeRoot.toLowerCase() : panel.runtimeRoot
          )
        )
        if (roots.size > 1) {
          vscode.window.showWarningMessage(t('maa.screencap.multiple-resources'))
          return
        }

        const [handle, panel] = activeInstances.sort(
          ([, left], [, right]) => right.sessionStartedAt - left.sessionStartedAt
        )[0]
        instance = handle
        runtimeRoot = vscode.Uri.file(panel.runtimeRoot)
      } else {
        const activeResource = rootService.activeResource
        if (!activeResource) {
          vscode.window.showErrorMessage(t('maa.screencap.no-runtime'))
          return
        }
        if (!(await launchService.updateCache())) {
          vscode.window.showErrorMessage(t('maa.screencap.failed'))
          return
        }
        runtimeRoot = activeResource.dirUri
      }

      const ipc = await serverService.ensureServer()
      const image = await ipc?.getScreencap(instance)
      if (!image) {
        vscode.window.showErrorMessage(t('maa.screencap.failed'))
        return
      }

      const screenshotDir = vscode.Uri.joinPath(runtimeRoot, 'debug', 'screenshot')
      await vscode.workspace.fs.createDirectory(screenshotDir)
      const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
      const screenshot = vscode.Uri.joinPath(screenshotDir, `${timestamp}.png`)
      await vscode.workspace.fs.writeFile(screenshot, Buffer.from(image, 'base64'))
      vscode.window.setStatusBarMessage(t('maa.screencap.saved', screenshot.fsPath), 5000)
    } catch (err) {
      logger.error(`screencap failed: ${err}`)
      vscode.window.showErrorMessage(t('maa.screencap.failed'))
    }
  }
}
