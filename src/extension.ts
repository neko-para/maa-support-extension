import * as maa from '@nekosu/maa-node'
import sms from 'source-map-support'
import * as vscode from 'vscode'

import { commands } from './command'
import { loadServices, resetInstance } from './data'
import { PipelineCompletionProvider } from './pipeline/completion'
import { PipelineDefinitionProvider } from './pipeline/definition'
import { PipelineHoverProvider } from './pipeline/hover'
import { PipelineReferenceProvider } from './pipeline/reference'
import { PipelineRenameProvider } from './pipeline/rename'
import { PipelineRootStatusProvider } from './pipeline/root'
import { PipelineTaskIndexProvider } from './pipeline/task'
import { ProjectInterfaceLaunchProvider } from './projectInterface/launcher'

sms.install()

export function activate(context: vscode.ExtensionContext) {
  console.log(maa.version())
  const logPath = context.storageUri
  if (logPath) {
    maa.set_global_option('LogDir', logPath.fsPath)
    vscode.commands.registerCommand(commands.OpenLog, async () => {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(logPath, 'maa.log'))
      if (doc) {
        await vscode.window.showTextDocument(doc)
      }
    })
  }

  loadServices(context, [
    PipelineRootStatusProvider,
    PipelineTaskIndexProvider,
    PipelineDefinitionProvider,
    PipelineCompletionProvider,
    PipelineReferenceProvider,
    PipelineHoverProvider,
    PipelineRenameProvider,

    ProjectInterfaceLaunchProvider
  ])
}

export function deactivate() {
  resetInstance()
}
