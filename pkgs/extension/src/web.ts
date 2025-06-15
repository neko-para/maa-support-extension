import { parse } from 'jsonc-parser'
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
import { interfaceIndexService, interfaceService, launchService, rootService } from './service'
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

  handler.value = async data => {
    logger.debug(`controlPanel ${data.cmd} ${JSON.stringify(data).slice(0, 200)}`)

    switch (data.cmd) {
      case 'refreshInterface':
        context.value.interfaceRefreshing = true

        await rootService.refresh()
        context.value.interfaceList = rootService.resourceRoots.map(x => x.interfaceRelative)
        context.value.interfaceCurrent = rootService.activeResource?.interfaceRelative

        await interfaceService.loadInterface()

        context.value.interfaceProjectDir = rootService.activeResource?.dirUri.fsPath
        context.value.interfaceObj = interfaceService.interfaceJson
        context.value.interfaceConfigObj = interfaceService.interfaceConfigJson

        context.value.interfaceRefreshing = false
        break
      case 'selectInterface': {
        context.value.interfaceRefreshing = true
        const rootIndex = rootService.resourceRoots.findIndex(
          x => x.interfaceRelative === data.interface
        )
        if (rootIndex !== -1) {
          const root = rootService.resourceRoots[rootIndex]
          context.value.interfaceCurrent = root.interfaceRelative
          rootService.select(rootIndex)

          await interfaceService.loadInterface()

          context.value.interfaceProjectDir = rootService.activeResource?.dirUri.fsPath
          context.value.interfaceObj = interfaceService.interfaceJson
          context.value.interfaceConfigObj = interfaceService.interfaceConfigJson
        }
        context.value.interfaceRefreshing = false
        break
      }
      case 'launchInterface':
        logger.debug(`Launch Interface, runtime ${JSON.stringify(data.runtime)}`)
        await launchService.launchRuntime(data.runtime)
        break
      case 'stopInterface':
        launchService.tasker?.tasker.post_stop()
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
          const decl = interfaceIndexService.entryDecl.find(x => x.name === info.entry)
          range = decl?.range
        } else if (data.dest.type === 'option') {
          const info = data.dest
          const decl = info.case
            ? interfaceIndexService.caseDecl.find(
                x => x.option === info.option && x.case === info.case
              )
            : interfaceIndexService.optionDecl.find(x => x.option === info.option)
          range = decl?.range
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
      await interfaceService.reduceConfig(v)
    },
    {
      deep: true
    }
  )

  handler.value({
    cmd: '__updateMaaEnum'
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
