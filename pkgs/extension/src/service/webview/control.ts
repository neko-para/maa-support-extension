import fs from 'fs/promises'
import { Node } from 'jsonc-parser'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import { locale, t } from '@mse/locale'
import { AbsolutePath, InterfaceRefInfo } from '@mse/pipeline-manager'
import { ControlHostState, ControlHostToWeb, ControlWebToHost } from '@mse/types'
import { WebviewProvider, provideWebview } from '@mse/utils'

import {
  interfaceService,
  launchService,
  nativeService,
  rootService,
  serverService,
  stateService,
  statusBarService
} from '..'
import { commands } from '../../command'
import { isMaaAssistantArknights } from '../../utils/fs'
import { BaseService, context } from '../context'
import { convertRange } from '../language/utils'
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

    this.provider.sendSt.on('change', bps => {
      this.updateTransportStatus()
    })

    this.provider.recvSt.on('change', bps => {
      this.updateTransportStatus()
    })

    this.provider.recv = async data => {
      switch (data.command) {
        case '__init':
          this.pushState()
          break
        case 'showSelect': {
          const choice = await vscode.window.showQuickPick<
            vscode.QuickPickItem & {
              value: string | number
            }
          >(
            data.options.map(opt => {
              return {
                value: opt.value,
                label: opt.title,
                description: opt.desc,
                detail: opt.subtitle
              }
            })
          )
          this.provider?.response(data.seq, choice?.value ?? null)
          break
        }
        case 'toolkitJump':
          switch (data.target) {
            case 'maa-log':
              await vscode.commands.executeCommand(commands.OpenMaaLog)
              break
            case 'ext-log':
              await vscode.commands.executeCommand(commands.OpenExtLog)
              break
            case 'crop-tool':
              await vscode.commands.executeCommand(commands.OpenCrop)
              break
            case 'switch-maa-ver':
              await vscode.commands.executeCommand(commands.NativeSelectMaa)
              break
            case 'switch-admin':
              serverService.switchAdmin()
              this.pushState()
              break
          }
          this.provider?.response(data.seq, null)
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
            resource: data.name
          })
          break
        case 'selectController':
          const name =
            data.index === -1
              ? '$fixed'
              : interfaceService.interfaceJson.controller?.[data.index].name
          interfaceService.reduceConfig({
            controller: name
              ? {
                  name
                }
              : undefined
          })
          break
        case 'refreshAdb': {
          const ipc = await serverService.ensureServer()
          this.provider?.response(data.seq, (await ipc?.refreshAdb()) ?? [])
          break
        }
        case 'refreshDesktop': {
          const ipc = await serverService.ensureServer()
          this.provider?.response(data.seq, (await ipc?.refreshDesktop()) ?? [])
          break
        }
        case 'configAdb':
          interfaceService.reduceConfig({
            adb: {
              adb_path: data.adb,
              address: data.address,
              screencap: data.screencap,
              input: data.input,
              config: data.config
            }
          })
          break
        case 'configDesktop':
          interfaceService.reduceConfig({
            [data.type]: {
              hwnd: data.handle
            }
          })
          break
        case 'configPlayCover':
          interfaceService.reduceConfig({
            playcover: {
              address: data.address
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
                option: {},
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
            task.option = task.option ?? {}
            const option = task.option[data.option] ?? {}
            if (typeof data.value === 'string') {
              option[data.name] = data.value
            } else {
              delete option[data.name]
            }
            task.option[data.option] = option
            interfaceService.reduceConfig({
              task: tasks
            })
          }
          break
        case 'revealInterface':
          let loc:
            | {
                file: AbsolutePath
                location: Node
              }
            | undefined = undefined
          switch (data.dest.type) {
            case 'entry': {
              const info = data.dest
              loc = interfaceService.interfaceBundle?.info.refs.find(
                ref => ref.type === 'interface.task_entry' && ref.target === info.entry
              )
              break
            }
            case 'option': {
              const info = data.dest
              loc = interfaceService.interfaceBundle?.info.decls.find(
                decl => decl.type === 'interface.option' && decl.name === info.option
              )
              break
            }
            case 'case': {
              const info = data.dest
              loc = interfaceService.interfaceBundle?.info.decls.find(
                decl =>
                  decl.type === 'interface.case' &&
                  decl.name === info.case &&
                  decl.option === info.option
              )
              break
            }
            case 'input': {
              const info = data.dest
              loc = interfaceService.interfaceBundle?.info.decls.find(
                decl =>
                  decl.type === 'interface.input' &&
                  decl.name === info.name &&
                  decl.option === info.option
              )
              break
            }
          }
          if (loc) {
            try {
              const doc = await vscode.workspace.openTextDocument(loc.file)
              const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active)
              if (editor) {
                const range = convertRange(doc, loc.location)
                editor.revealRange(range)
                editor.selection = new vscode.Selection(range.start, range.end)
              }
            } catch {}
          }
          break
        case 'launch':
          const runtime = await interfaceService.buildRuntime()
          if (typeof runtime === 'string') {
            vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
            break
          }
          launchService.launchRuntime(runtime)
          break
        case 'translate':
          if (!data.key.startsWith('$')) {
            this.provider?.response(data.seq, data.key)
            break
          }
          const intBundle = interfaceService.interfaceBundle
          if (!intBundle) {
            this.provider?.response(data.seq, data.key)
            break
          }

          const preferredLocale = interfaceService.interfaceConfigJson.locale
          const preferredIndex = intBundle.langBundle.queryName(preferredLocale)

          const result = intBundle.langBundle.queryKey(data.key.slice(1))
          this.provider?.response(data.seq, result?.[preferredIndex]?.value ?? data.key)
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

    this.defer = nativeService.onVersionChanged(() => {
      this.pushState()
    })
  }

  updateTransportStatus() {
    if (this.provider) {
      let sum = this.provider.sendSt.sum + this.provider.recvSt.sum
      statusBarService.transportItem.text = `${(sum / 5000).toFixed(2)} kbps`
    }
  }

  get state(): ControlHostState {
    return {
      isMAA: isMaaAssistantArknights,
      fwStatus: nativeService.currentVersionInfo,
      locale,

      admin: process.platform === 'win32' ? serverService.rpc.admin : undefined,

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
