import path from 'path'
import { defineExtension, useCommand, useOutputChannel, watch } from 'reactive-vscode'
import sms from 'source-map-support'
import vscode from 'vscode'

import {
  ControlPanelContext,
  ControlPanelFromHost,
  ControlPanelToHost,
  Interface,
  InterfaceConfig,
  OldWebContext,
  OldWebFromHost,
  OldWebToHost
} from '@mse/types'
import { createUseWebPanel, createUseWebView, logger, setupLogger, t } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { loadServices, sharedInstance } from './data'
import { Maa, maa, setupMaa } from './maa'
import { PipelineCodeLensProvider } from './pipeline/codeLens'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineDocumentLinkProvider } from './pipeline/documentLink'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'
import { ProjectInterfaceCodeLensProvider } from './projectInterface/codeLens'
import { ProjectInterfaceCompletionProvider } from './projectInterface/completion'
import { ProjectInterfaceDefinitionProvider } from './projectInterface/definition'
import { ProjectInterfaceIndexerProvider } from './projectInterface/indexer'
import { ProjectInterfaceJsonProvider } from './projectInterface/json'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'
import { ProjectInterfaceReferenceProvider } from './projectInterface/reference'

sms.install()

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

export function focusAndWaitPanel() {
  return new Promise<void>(resolve => {
    const { visible, awakeListener } = useControlPanel()

    if (!visible.value) {
      logger.info('Focus controlPanel')
      vscode.commands.executeCommand('maa.view.control-panel.focus')

      awakeListener.value.push(resolve)
    } else {
      resolve()
    }

    return true
  })
}

function initControlPanel() {
  const { handler, context } = useControlPanel()

  const tryParse = <T>(x?: string | null) => {
    try {
      return x ? (JSON.parse(x) as T) : undefined
    } catch {
      return undefined
    }
  }

  handler.value = async data => {
    logger.debug(`controlPanel ${data.cmd} ${JSON.stringify(data).slice(0, 200)}`)

    switch (data.cmd) {
      case 'refreshInterface':
        context.value.interfaceRefreshing = true

        await sharedInstance(PipelineRootStatusProvider).syncRootInfo(
          context.value.interfaceCurrent
        )
        context.value.interfaceList = sharedInstance(PipelineRootStatusProvider).resourceRoot.map(
          x => x.interfaceRelative
        )
        context.value.interfaceCurrent = sharedInstance(
          PipelineRootStatusProvider
        ).activateResource.value?.interfaceRelative

        await sharedInstance(ProjectInterfaceJsonProvider).loadInterface()

        context.value.interfaceProjectDir = sharedInstance(
          PipelineRootStatusProvider
        ).activateResource.value?.dirUri.fsPath
        context.value.interfaceObj =
          tryParse<Interface>(
            await sharedInstance(ProjectInterfaceJsonProvider).interfaceContent
          ) ?? undefined
        context.value.interfaceConfigObj =
          tryParse<InterfaceConfig>(
            await sharedInstance(ProjectInterfaceJsonProvider).interfaceConfigContent
          ) ?? undefined

        context.value.interfaceRefreshing = false
        break
      case 'selectInterface': {
        context.value.interfaceRefreshing = true
        const rootIndex = sharedInstance(PipelineRootStatusProvider).resourceRoot.findIndex(
          x => x.interfaceRelative === data.interface
        )
        if (rootIndex !== -1) {
          const root = sharedInstance(PipelineRootStatusProvider).resourceRoot[rootIndex]
          context.value.interfaceCurrent = root.interfaceRelative
          sharedInstance(PipelineRootStatusProvider).selectRootInfo(rootIndex)

          await sharedInstance(ProjectInterfaceJsonProvider).loadInterface()

          context.value.interfaceProjectDir = sharedInstance(
            PipelineRootStatusProvider
          ).activateResource.value?.dirUri.fsPath
          context.value.interfaceObj =
            tryParse<Interface>(
              await sharedInstance(ProjectInterfaceJsonProvider).interfaceContent
            ) ?? undefined
          context.value.interfaceConfigObj =
            tryParse<InterfaceConfig>(
              await sharedInstance(ProjectInterfaceJsonProvider).interfaceConfigContent
            ) ?? undefined
        }
        context.value.interfaceRefreshing = false
        break
      }
      case 'launchInterface':
        logger.debug(`Launch Interface, runtime ${JSON.stringify(data.runtime)}`)
        if (context.value.interfaceLaunching) {
          logger.warn(`Launch Interface failed, another interface launching`)
          break
        }
        context.value.interfaceLaunching = true
        await sharedInstance(ProjectInterfaceLaunchProvider).launchInterface(data.runtime)
        context.value.interfaceLaunching = false
        break
      case 'stopInterface':
        sharedInstance(ProjectInterfaceLaunchProvider).tasker?.tasker.post_stop()
        break
      case 'refreshAdbDevice': {
        context.value.adbDeviceRefreshing = true
        const devs = (await maa.AdbController.find()) ?? []
        context.value.adbDeviceList = devs.map(d => ({
          name: d[0],
          adb_path: d[1],
          address: d[2],
          config: JSON.parse(d[5])
        }))
        context.value.adbDeviceRefreshing = false
        break
      }
      case 'refreshDesktopWindow': {
        context.value.desktopWindowRefreshing = true
        const devs = (await maa.Win32Controller.find()) ?? []
        context.value.desktopWindowList = devs.map(d => ({
          hwnd: d[0],
          class_name: d[1],
          window_name: d[2]
        }))
        context.value.desktopWindowRefreshing = false
        break
      }
      case 'revealInterfaceAt': {
        let range: vscode.Range | undefined = undefined

        if (data.dest.type === 'entry') {
          const info = data.dest
          const decl = sharedInstance(ProjectInterfaceIndexerProvider).entryDecl.find(
            x => x.name === info.entry
          )
          range = decl?.range
        } else if (data.dest.type === 'option') {
          const info = data.dest
          const decl = info.case
            ? sharedInstance(ProjectInterfaceIndexerProvider).caseDecl.find(
                x => x.option === info.option && x.case === info.case
              )
            : sharedInstance(ProjectInterfaceIndexerProvider).optionDecl.find(
                x => x.option === info.option
              )
          range = decl?.range
        }
        if (range) {
          const doc = await vscode.workspace.openTextDocument(
            sharedInstance(ProjectInterfaceIndexerProvider).interfaceUri!
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
      }
    }
  }

  watch(
    () => context.value.interfaceConfigObj,
    async v => {
      await sharedInstance(ProjectInterfaceJsonProvider).saveConfig(
        v ? JSON.stringify(v, null, 4) : undefined
      )
    },
    {
      deep: true
    }
  )

  handler.value({
    cmd: 'refreshInterface'
  })

  context.value.maaEnum = {
    Status: maa.api.Status,
    AdbScreencapMethod: maa.api.AdbScreencapMethod,
    AdbInputMethod: maa.api.AdbInputMethod,
    Win32ScreencapMethod: maa.api.Win32ScreencapMethod,
    Win32InputMethod: maa.api.Win32InputMethod
  }
}

const innerUseOldWebPanel = createUseWebPanel<OldWebContext, OldWebToHost, OldWebFromHost>(
  'web',
  'maa.Webview',
  true
)

function toPngDataUrl(buffer: ArrayBuffer) {
  return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
}

export async function useOldWebPanel(column: vscode.ViewColumn = vscode.ViewColumn.Active) {
  const p = await innerUseOldWebPanel('Maa Support', column)
  const { handler, context, post } = p

  context.value.selectFill = vscode.workspace.getConfiguration('maa').get('crop.selectFill')

  handler.value = async data => {
    logger.debug(`oldWeb ${data.cmd} ${JSON.stringify(data).slice(0, 200)}`)

    const pilp = sharedInstance(ProjectInterfaceLaunchProvider)

    switch (data.cmd) {
      case 'launch.reco':
        const detailInfo = pilp.tasker?.tasker.recognition_detail(data.reco as Maa.api.RecoId)
        if (!detailInfo) {
          return
        }
        detailInfo.detail = JSON.stringify(JSON.parse(detailInfo.detail), null, 4)
        post({
          cmd: 'show.reco',
          raw: toPngDataUrl(detailInfo.raw),
          draws: detailInfo.draws.map(toPngDataUrl),
          info: detailInfo
        })
        return
      case 'launch.stop':
        pilp.tasker?.tasker.post_stop()
        break
      case 'crop.screencap':
        if (!sharedInstance(PipelineRootStatusProvider).activateResource.value) {
          return
        }
        if ((await pilp.updateCache()) && pilp.cache) {
          await pilp.cache.controller.post_screencap().wait()
          const image = pilp.cache.controller.cached_image
          if (!image) {
            return
          }
          post({
            cmd: 'crop.image',
            image: toPngDataUrl(image)
          })
        }
        break
      case 'crop.upload': {
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Upload',
          filters: {
            'Png files': ['png']
          },
          defaultUri: context.value.uploadDir ? vscode.Uri.file(context.value.uploadDir) : undefined
        }

        const files = await vscode.window.showOpenDialog(options)
        if (!files || files.length === 0) {
          break
        }

        context.value.uploadDir = path.dirname(files[0].fsPath)

        const data = await vscode.workspace.fs.readFile(files[0])
        post({
          cmd: 'crop.image',
          image: toPngDataUrl(data)
        })
        break
      }
      case 'crop.download':
        const root = sharedInstance(ProjectInterfaceJsonProvider).suggestResource()
        if (!root) {
          return
        }
        const imageRoot = vscode.Uri.joinPath(root, 'image')
        const name = await vscode.window.showInputBox({
          title: t('maa.pi.title.input-image')
        })
        if (!name) {
          return
        }
        const resultPath = vscode.Uri.joinPath(
          imageRoot,
          `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
        )
        await vscode.workspace.fs.writeFile(resultPath, Buffer.from(data.image, 'base64'))
        break
    }
  }

  return p
}

async function setup(context: vscode.ExtensionContext) {
  const channel = useOutputChannel('Maa')
  const logFile = vscode.Uri.joinPath(context.storageUri ?? context.globalStorageUri, 'mse.log')
  await setupLogger(channel, logFile)

  useCommand(commands.OpenExtLog, async () => {
    const doc = await vscode.workspace.openTextDocument(logFile)
    if (doc) {
      await vscode.window.showTextDocument(doc)
    }
  })

  setupMaa()

  initControlPanel()

  logger.info(`MaaSupport version ${packageJson.version ?? 'dev'}`)
  logger.info(`MaaFramework version ${maa.Global.version}`)
  maa.Global.debug_mode = true
  const logPath = context.storageUri
  if (logPath) {
    maa.Global.log_dir = logPath.fsPath
    useCommand(commands.OpenMaaLog, async () => {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(logPath, 'maa.log'))
      if (doc) {
        await vscode.window.showTextDocument(doc)
      }
    })
  }

  useCommand(commands.PISwitchResource, (res: string) => {
    const { handler, context } = useControlPanel()
    const cfg = context.value.interfaceConfigObj
    if (cfg) {
      cfg.resource = res
    }
  })

  useCommand(commands.RevealControlPanel, () => {
    focusAndWaitPanel()
  })

  useCommand(commands.OpenWeb, () => {
    useOldWebPanel()
  })

  loadServices([
    PipelineRootStatusProvider,
    PipelineTaskIndexProvider,
    PipelineDefinitionProvider,
    PipelineDocumentLinkProvider,
    PipelineCompletionProvider,
    PipelineReferenceProvider,
    PipelineHoverProvider,
    PipelineCodeLensProvider,

    ProjectInterfaceIndexerProvider,
    ProjectInterfaceCodeLensProvider,
    ProjectInterfaceCompletionProvider,
    ProjectInterfaceDefinitionProvider,
    ProjectInterfaceReferenceProvider,
    ProjectInterfaceLaunchProvider
  ])
}

export const { activate, deactivate } = defineExtension(context => {
  setup(context)
})
