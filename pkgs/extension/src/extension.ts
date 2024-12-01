import * as maa from '@maaxyz/maa-node'
import { JSONParse, JSONStringify, Json } from 'json-with-bigint'
import { defineExtension, useCommand, watch } from 'reactive-vscode'
import sms from 'source-map-support'
import vscode from 'vscode'

import {
  ControlPanelContext,
  ControlPanelFromHost,
  ControlPanelToHost,
  Interface,
  InterfaceConfig
} from '@mse/types'
import { createUseWebView } from '@mse/utils'

import { commands } from './command'
import { loadServices, sharedInstance } from './data'
import { PipelineCodeLensProvider } from './pipeline/codeLens'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineProjectInterfaceProvider } from './pipeline/pi'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRenameProvider } from './pipeline/rename'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'
import { ProjectInterfaceWebProvider } from './projectInterface/web'

sms.install()

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

function initControlPanel() {
  const { handler, context } = useControlPanel()

  const tryParse = <T>(x?: string | null) => {
    return x ? JSONParse<T>(x) : undefined
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
        sharedInstance(ProjectInterfaceLaunchProvider).launchInterface(5)
        context.value.interfaceLaunching = false
        break
    }
  }

  watch(
    () => context.value.interfaceConfigObj,
    async v => {
      await sharedInstance(PipelineProjectInterfaceProvider).saveConfig(
        v ? JSONStringify(v, 4) : undefined
      )
      await sharedInstance(PipelineProjectInterfaceProvider).loadInterface()
    },
    {
      deep: true
    }
  )

  handler.value({
    cmd: 'refreshInterface'
  })
}

export const { activate, deactivate } = defineExtension(context => {
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

  loadServices([
    PipelineRootStatusProvider,
    PipelineTaskIndexProvider,
    PipelineDefinitionProvider,
    PipelineCompletionProvider,
    PipelineReferenceProvider,
    PipelineHoverProvider,
    PipelineRenameProvider,
    PipelineCodeLensProvider,

    ProjectInterfaceLaunchProvider,
    ProjectInterfaceWebProvider
  ])
})
