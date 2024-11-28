import * as maa from '@maaxyz/maa-node'
import { defineExtension, useCommand } from 'reactive-vscode'
import vscode from 'vscode'

import { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { createUseWebView } from '@mse/utils'

import { commands } from './command'
import { loadServices } from './data'
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
  const { handler, post } = useControlPanel()

  handler.value = data => {
    switch (data.cmd) {
      case 'refreshInterface':
        break
    }
  }
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
