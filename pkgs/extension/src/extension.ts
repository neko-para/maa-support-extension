import path from 'path'
import { defineExtension, useCommand, watch } from 'reactive-vscode'
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
import { createUseWebPanel, createUseWebView, t } from '@mse/utils'

import { commands } from './command'
import { loadServices, sharedInstance } from './data'
import { Maa, maa, setupMaa } from './maa'
import { PipelineCodeLensProvider } from './pipeline/codeLens'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineDocumentLinkProvider } from './pipeline/documentLink'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineProjectInterfaceProvider } from './pipeline/pi'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRenameProvider } from './pipeline/rename'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'
import { ProjectInterfaceCodeLensProvider } from './projectInterface/codeLens'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'

sms.install()

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

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
        ).activateResource?.interfaceRelative

        await sharedInstance(PipelineProjectInterfaceProvider).loadInterface()
        sharedInstance(ProjectInterfaceCodeLensProvider).didChangeCodeLenses.fire()

        context.value.interfaceProjectDir = sharedInstance(
          PipelineRootStatusProvider
        ).activateResource?.dirUri.fsPath
        context.value.interfaceObj =
          tryParse<Interface>(
            await sharedInstance(PipelineProjectInterfaceProvider).interfaceContent
          ) ?? undefined
        context.value.interfaceConfigObj =
          tryParse<InterfaceConfig>(
            await sharedInstance(PipelineProjectInterfaceProvider).interfaceConfigContent
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

          await sharedInstance(PipelineProjectInterfaceProvider).loadInterface()
          sharedInstance(ProjectInterfaceCodeLensProvider).didChangeCodeLenses.fire()

          context.value.interfaceProjectDir = sharedInstance(
            PipelineRootStatusProvider
          ).activateResource?.dirUri.fsPath
          context.value.interfaceObj =
            tryParse<Interface>(
              await sharedInstance(PipelineProjectInterfaceProvider).interfaceContent
            ) ?? undefined
          context.value.interfaceConfigObj =
            tryParse<InterfaceConfig>(
              await sharedInstance(PipelineProjectInterfaceProvider).interfaceConfigContent
            ) ?? undefined
        }
        context.value.interfaceRefreshing = false
        break
      }
      case 'launchInterface':
        context.value.interfaceLaunching = true
        await sharedInstance(ProjectInterfaceLaunchProvider).launchInterface(data.runtime)
        context.value.interfaceLaunching = false
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
          window_name: d[1],
          class_name: d[2]
        }))
        context.value.desktopWindowRefreshing = false
        break
      }
    }
  }

  watch(
    () => context.value.interfaceConfigObj,
    async v => {
      await sharedInstance(PipelineProjectInterfaceProvider).saveConfig(
        v ? JSON.stringify(v, null, 4) : undefined
      )

      await sharedInstance(PipelineProjectInterfaceProvider).loadInterface()
      sharedInstance(ProjectInterfaceCodeLensProvider).didChangeCodeLenses.fire()
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

  handler.value = async data => {
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
        if (!sharedInstance(PipelineRootStatusProvider).activateResource) {
          return
        }
        const runtime = await pilp.prepareRuntime(
          sharedInstance(PipelineRootStatusProvider).activateResource!.dirUri.fsPath
        )
        if (!runtime) {
          return
        }
        if (!(await pilp.setupInstance(runtime, true)) || !pilp.tasker) {
          return
        }
        await pilp.tasker.controller.post_screencap().wait()
        const image = pilp.tasker.controller.cached_image
        if (!image) {
          return
        }
        post({
          cmd: 'crop.image',
          image: toPngDataUrl(image)
        })
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
        const root = sharedInstance(PipelineProjectInterfaceProvider).suggestResource()
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

export const { activate, deactivate } = defineExtension(context => {
  setupMaa()

  initControlPanel()

  console.log(maa.Global.version)
  maa.Global.debug_mode = true
  const logPath = context.storageUri
  if (logPath) {
    maa.Global.log_dir = logPath.fsPath
    useCommand(commands.OpenLog, async () => {
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
    PipelineRenameProvider,
    PipelineCodeLensProvider,

    ProjectInterfaceCodeLensProvider,
    ProjectInterfaceLaunchProvider
  ])
})
