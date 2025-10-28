import fs from 'fs/promises'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { ControlHostState, ControlHostToWeb, ControlWebToHost } from '@mse/types'
import { WebviewProvider, locale, provideWebview, t } from '@mse/utils'

import {
  interfaceIndexService,
  interfaceService,
  launchService,
  rootService,
  stateService
} from '..'
import { commands } from '../../command'
import { isMaaAssistantArknights } from '../../utils/fs'
import { BaseService, context } from '../context'
import { isCtrlDev } from './dev'

export class WebviewControlService extends BaseService {
  provider?: WebviewProvider<ControlHostToWeb, ControlWebToHost>

  constructor() {
    super()
  }

  async init() {
    this.provider = provideWebview<ControlHostToWeb, ControlWebToHost>({
      context,
      folder: 'webview',
      index: 'control',
      webId: 'maa.view.control-panel',
      dev: isCtrlDev
    })

    this.provider.recv = async data => {
      switch (data.command) {
        case '__init':
          this.pushState()
          break
        case 'refreshInterface':
          await rootService.refresh()
          break
        case 'selectInterface':
          rootService.selectPath(data.path)
          break
        case 'revealConfig':
          rootService.revealConfig()
          break
        case 'selectResource':
          interfaceService.reduceConfig({
            resource: interfaceService.interfaceJson.resource?.[data.index].name
          })
          break
        case 'selectController':
          const name = interfaceService.interfaceJson.controller?.[data.index].name
          interfaceService.reduceConfig({
            controller: name
              ? {
                  name
                }
              : undefined
          })
          break
        case 'refreshAdb':
          this.provider?.response(data.seq, await maa.AdbController.find())
          break
        case 'refreshDesktop':
          this.provider?.response(data.seq, await maa.Win32Controller.find())
          break
        case 'configAdb':
          interfaceService.reduceConfig({
            adb: {
              adb_path: data.adb,
              address: data.address,
              config: data.config
            }
          })
          break
        case 'configDesktop':
          interfaceService.reduceConfig({
            win32: {
              hwnd: data.handle
            }
          })
          break
        case 'uploadImage': {
          const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Upload',
            filters: {
              'Png files': ['png']
            },
            defaultUri: stateService.state.uploadDir
              ? vscode.Uri.file(stateService.state.uploadDir)
              : undefined
          }
          const files = await vscode.window.showOpenDialog(options)
          if (!files || files.length === 0) {
            break
          }

          const folder = vscode.Uri.joinPath(context.storageUri!, 'fixed')
          await fs.mkdir(folder.fsPath, { recursive: true })
          const target = vscode.Uri.joinPath(folder, v4() + '.png')
          await fs.copyFile(files[0].fsPath, target.fsPath)
          await interfaceService.reduceConfig({
            vscFixed: {
              image: target.fsPath
            }
          })
          break
        }
        case 'addTask':
          interfaceService.reduceConfig({
            task: (interfaceService.interfaceConfigJson.task ?? []).concat([
              {
                name: data.task,
                option: [],
                __vscKey: v4()
              }
            ])
          })
          break
        case 'removeTask':
          interfaceService.reduceConfig({
            task:
              interfaceService.interfaceConfigJson.task?.filter(
                task => task.__vscKey !== data.key
              ) ?? []
          })
          break
        case 'configTask':
          const tasks = interfaceService.interfaceConfigJson.task
          const task = tasks?.find(info => info.__vscKey === data.key)
          if (task) {
            const option = task.option?.find(opt => opt.name === data.option)
            if (option) {
              option.value = data.value
            } else {
              task.option = (task.option ?? []).concat([
                {
                  name: data.option,
                  value: data.value
                }
              ])
            }
            interfaceService.reduceConfig({
              task: tasks
            })
          }
          break
        case 'revealInterface':
          let range: vscode.Range | undefined = undefined
          switch (data.dest.type) {
            case 'entry': {
              const info = data.dest
              range = interfaceIndexService.entryDecl.find(x => x.name === info.entry)?.range
              break
            }
            case 'option': {
              const info = data.dest
              range = interfaceIndexService.optionDecl.find(x => x.option === info.option)?.range
              break
            }
            case 'case': {
              const info = data.dest
              range = interfaceIndexService.caseDecl.find(
                x => x.option === info.option && x.case === info.case
              )?.range
              break
            }
            case 'input': {
              const info = data.dest
              range = interfaceIndexService.inputDecl.find(
                x => x.option === info.option && x.name === info.name
              )?.range
              break
            }
          }
          if (range) {
            try {
              const doc = await vscode.workspace.openTextDocument(
                rootService.activeResource!.interfaceUri
              )
              const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active)
              if (editor) {
                editor.revealRange(range)
                editor.selection = new vscode.Selection(range.start, range.end)
              }
            } catch {}
          }
          break
        case 'launch':
          const runtime = interfaceService.buildRuntime()
          if (typeof runtime === 'string') {
            vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
            break
          }
          launchService.launchRuntime(runtime)
          break
        case 'maa.evalTask':
          await vscode.commands.executeCommand(commands.EvalTask, data.task)
          break
        case 'maa.evalExpr':
          await vscode.commands.executeCommand(
            commands.EvalExpr,
            data.expr,
            data.host,
            stateService.state.evalTaskConfig?.stripList ?? true
          )
          break
        case 'maa.updateEvalConfig':
          stateService.reduce({
            evalTaskConfig: data.config
          })
          this.pushState()
          break
      }
    }

    this.defer = rootService.onRefreshingChanged(() => {
      this.pushState()
    })

    this.defer = rootService.onActiveResourceChanged(() => {
      this.pushState()
    })

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.pushState()
    })

    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.pushState()
    })
  }

  get state(): ControlHostState {
    return {
      isMAA: isMaaAssistantArknights,
      locale,

      interface: rootService.resourceRoots.map(root => root.interfaceRelative),
      activeInterface: rootService.activeResource?.interfaceRelative,
      refreshingInterface: rootService.refreshing,

      interfaceJson: interfaceService.interfaceJson,
      interfaceConfigJson: interfaceService.interfaceConfigJson,

      evalTaskConfig: stateService.state.evalTaskConfig
    }
  }

  pushState() {
    this.provider?.send({
      command: 'updateState',
      state: this.state
    })
  }
}
