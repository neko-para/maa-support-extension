import * as fs from 'fs/promises'
import type { Node } from 'jsonc-parser'
import { v4 } from 'uuid'
import * as vscode from 'vscode'

import type {
  ControlHostState,
  ControlHostToWeb,
  ControlWebToHost,
  InterfaceRevealOption
} from '@mse/types'
import { WebviewProvider, logger, provideWebview } from '@mse/utils'
import { locale, t } from '@nekosu/maa-locale'
import type { AbsolutePath } from '@nekosu/maa-pipeline-manager'

import {
  interfaceService,
  launchService,
  nativeService,
  rootService,
  serverService,
  stateService
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

    this.provider.recv = async data => {
      switch (data.command) {
        case '__init':
          this.pushState()
          this.pushInterface()
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
        case 'selectController': {
          const name =
            data.index === -1
              ? '$fixed'
              : interfaceService.interfaceJson.controller?.[data.index].name
          interfaceService.reduceConfig({
            controller: name
          })
          break
        }
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
        case 'usePreset': {
          const presetInfo = interfaceService.interfaceJson.preset?.find(
            preset => preset.name === data.preset
          )
          if (!presetInfo) {
            break
          }
          interfaceService.reduceConfig({
            task:
              presetInfo.task?.map(presetTask => {
                return {
                  name: presetTask.name,
                  option: presetTask.option ?? {},
                  __key: v4()
                }
              }) ?? []
          })
          break
        }
        case 'addTask':
          interfaceService.reduceConfig({
            task: (interfaceService.interfaceConfigJson.task ?? []).concat([
              {
                name: data.task,
                option: {},
                __key: v4()
              }
            ])
          })
          break
        case 'removeTask':
          interfaceService.reduceConfig({
            task:
              interfaceService.interfaceConfigJson.task?.filter(task => task.__key !== data.key) ??
              []
          })
          break
        case 'configTask': {
          const tasks = interfaceService.interfaceConfigJson.task
          const task = tasks?.find(info => info.__key === data.key)
          if (task) {
            task.option = task.option ?? {}
            task.option[data.option] = data.value
            interfaceService.reduceConfig({
              task: tasks
            })
          }
          break
        }
        case 'revealInterface': {
          this.revealInterface(data.dest)
          break
        }
        case 'launch': {
          const runtime = await interfaceService.buildRuntime()
          if (typeof runtime === 'string') {
            vscode.window.showErrorMessage(t('maa.pi.error.generate-runtime-failed', runtime))
            break
          }
          launchService.launchRuntime(runtime)
          break
        }
        case 'translate': {
          if (!data.key.startsWith('$')) {
            this.provider?.response(data.seq, data.key)
            break
          }
          const intBundle = interfaceService.interfaceBundle
          if (!intBundle) {
            this.provider?.response(data.seq, data.key)
            break
          }

          const preferredLocale = interfaceService.interfaceConfigJson.__locale
          const preferredIndex = intBundle.langBundle.queryName(preferredLocale)

          const result = intBundle.langBundle.queryKey(data.key.slice(1))
          this.provider?.response(data.seq, result?.[preferredIndex]?.value ?? data.key)
          break
        }
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
      this.pushInterface()
    })

    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.pushState()
    })

    this.defer = serverService.onStatusChanged(() => {
      this.pushState()
    })

    this.defer = nativeService.onVersionChanged(() => {
      this.pushState()
    })
  }

  async revealInterface(dest?: InterfaceRevealOption) {
    const bundle = interfaceService.interfaceBundle
    if (!bundle) {
      return
    }

    let loc:
      | {
          file: AbsolutePath
          location: Node
        }
      | undefined = undefined

    switch (dest?.type) {
      case 'entry':
        loc = bundle.info.refs.find(
          ref =>
            ref.type === 'interface.task_entry' &&
            ref.target === dest.entry &&
            ref.task === dest.task
        )
        break
      case 'controller':
        loc = bundle.info.decls.find(
          decl => decl.type === 'interface.controller' && decl.name === dest.ctrl
        )
        break
      case 'resource':
        loc = bundle.info.decls.find(
          decl => decl.type === 'interface.resource' && decl.name === dest.res
        )
        break
      case 'task':
        loc = bundle.info.decls.find(
          decl => decl.type === 'interface.task' && decl.name === dest.task
        )
        break
      case 'option':
        loc = bundle.info.decls.find(
          decl => decl.type === 'interface.option' && decl.name === dest.option
        )
        break
      case 'case':
        loc = bundle.info.decls.find(
          decl =>
            decl.type === 'interface.case' && decl.name === dest.case && decl.option === dest.option
        )
        break
      case 'input':
        loc = bundle.info.decls.find(
          decl =>
            decl.type === 'interface.input' &&
            decl.name === dest.name &&
            decl.option === dest.option
        )
        break
      case 'option_ref':
        loc = bundle.info.refs
          .filter(ref => ref.type === 'interface.option')
          .find(
            ref =>
              ref.trace.name === dest.trace.name &&
              ref.trace.from === dest.trace.from &&
              ref.trace.origin === dest.trace.origin
          )
        break
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
      } catch (err) {
        logger.error(`${err}`)
      }
    } else {
      if (bundle.file) {
        const doc = await vscode.workspace.openTextDocument(bundle.file)
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active)
      }
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

  pushInterface() {
    this.provider?.send({
      command: 'updateInterface',
      interfaceJson: interfaceService.interfaceJson
    })
  }
}
