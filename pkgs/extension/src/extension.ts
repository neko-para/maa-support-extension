import * as maa from '@maaxyz/maa-node'
import { defineExtension, useCommand } from 'reactive-vscode'
import vscode from 'vscode'

import { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { createUseWebView } from '@mse/utils'

import { commands } from './command'
import { loadServices, sharedInstance } from './data'
import { PipelineCodeLensProvider } from './pipeline/codeLens'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRenameProvider } from './pipeline/rename'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'
import { ProjectInterfaceWebProvider } from './projectInterface/web'

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

function initControlPanel() {
  const { handler, context } = useControlPanel()

  handler.value = async data => {
    switch (data.cmd) {
      case 'refreshInterface':
        await sharedInstance(PipelineRootStatusProvider).syncRootInfo(
          context.value.interfaceCurrent
        )
        context.value.interfaceList = sharedInstance(PipelineRootStatusProvider).resourceRoot.map(
          x => x.interfaceRelative
        )
        context.value.interfaceCurrent = sharedInstance(
          PipelineRootStatusProvider
        ).activateResource?.interfaceRelative
        break
      case 'selectInterface': {
        const rootIndex = sharedInstance(PipelineRootStatusProvider).resourceRoot.findIndex(
          x => x.interfaceRelative === data.interface
        )
        if (rootIndex !== -1) {
          const root = sharedInstance(PipelineRootStatusProvider).resourceRoot[rootIndex]
          context.value.interfaceCurrent = root.interfaceRelative
          sharedInstance(PipelineRootStatusProvider).selectRootInfo(rootIndex)
        }
        break
      }
    }
  }

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
