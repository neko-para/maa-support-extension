import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { ControlHostState, ControlHostToWeb, ControlWebToHost } from '@mse/types'
import { WebviewProvider, provideWebview } from '@mse/utils'

import { interfaceIndexService, interfaceService, launchService, rootService } from '..'
import { maa } from '../../maa'
import { BaseService, context } from '../context'

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
      webId: 'maa.view.control-panel-new',
      dev: true
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
        case 'selectResource':
          interfaceService.reduceConfig({
            resource: interfaceService.interfaceJson.resource?.[data.index].name
          })
          break
        case 'refreshAdb':
          this.provider?.response(data.seq, await maa.AdbController.find())
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
            }
          }
          if (range) {
            const doc = await vscode.workspace.openTextDocument(
              rootService.activeResource!.interfaceUri
            )
            if (doc) {
              const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active)
              if (editor) {
                editor.revealRange(range)
                editor.selection = new vscode.Selection(range.start, range.end)
              }
            }
          }
          break
        case 'launch':
          const runtime = interfaceService.buildRuntime()
          if (typeof runtime === 'string') {
            vscode.window.showErrorMessage(`生成配置失败: ${runtime}`)
            break
          }
          launchService.launchRuntime(runtime)
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
      interface: rootService.resourceRoots.map(root => root.interfaceRelative),
      activeInterface: rootService.activeResource?.interfaceRelative,
      refreshingInterface: rootService.refreshing,

      interfaceJson: interfaceService.interfaceJson,
      interfaceConfigJson: interfaceService.interfaceConfigJson
    }
  }

  pushState() {
    this.provider?.send({
      command: 'updateState',
      state: this.state
    })
  }
}
