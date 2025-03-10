import path from 'path'
import { watch } from 'reactive-vscode'
import vscode from 'vscode'

import {
  ControlPanelContext,
  ControlPanelFromHost,
  ControlPanelToHost,
  CropViewContext,
  CropViewFromHost,
  CropViewToHost,
  Interface,
  InterfaceConfig,
  LaunchViewContext,
  LaunchViewFromHost,
  LaunchViewToHost
} from '@mse/types'
import { createUseWebPanel, createUseWebView, logger, t } from '@mse/utils'

import { sharedInstance } from './data'
import { maa } from './maa'
import { PipelineRootStatusProvider } from './pipeline/root'
import { ProjectInterfaceIndexerProvider } from './projectInterface/indexer'
import { ProjectInterfaceJsonProvider } from './projectInterface/json'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'
import { isCropDev, isCtrlDev, isLaunchDev } from './webview/dev'

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'control', 'maa.view.control-panel', isCtrlDev)

export function focusAndWaitPanel() {
  const { focus } = useControlPanel()
  return focus('maa.view.control-panel.focus')
}

export function initControlPanel() {
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
        await sharedInstance(ProjectInterfaceLaunchProvider).launchInterface(data.runtime)
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
      case '__updateMaaEnum':
        context.value.maaEnum = {
          Status: maa.api.Status,
          AdbScreencapMethod: maa.api.AdbScreencapMethod,
          AdbInputMethod: maa.api.AdbInputMethod,
          Win32ScreencapMethod: maa.api.Win32ScreencapMethod,
          Win32InputMethod: maa.api.Win32InputMethod
        }
        break
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
    cmd: '__updateMaaEnum'
  })
  handler.value({
    cmd: 'refreshInterface'
  })
}

const innerUseLaunchView = createUseWebPanel<
  LaunchViewContext,
  LaunchViewToHost,
  LaunchViewFromHost
>('controlPanel', 'launch', 'maa.view.launch', isLaunchDev, true)

export async function useLaunchView(column: vscode.ViewColumn = vscode.ViewColumn.Active) {
  return await innerUseLaunchView('Maa Launch', column)
}

const innerUseCropView = createUseWebPanel<CropViewContext, CropViewToHost, CropViewFromHost>(
  'controlPanel',
  'crop',
  'maa.view.crop',
  isCropDev,
  true
)

export async function useCropView(column: vscode.ViewColumn = vscode.ViewColumn.Active) {
  return await innerUseCropView('Maa Crop', column)
}
