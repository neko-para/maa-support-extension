import open from 'open'
import sms from 'source-map-support'
import * as vscode from 'vscode'

import { commands } from './command'
import { loadServices, resetInstance } from './data'
import { maa, setupMaa } from './maa/loader'
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

sms.install()

let activated = false

async function trySetupMaa(context: vscode.ExtensionContext) {
  if (activated) {
    return true
  }
  const succeeded = await setupMaa(
    vscode.Uri.joinPath(context.globalStorageUri, 'node_modules').fsPath
  )
  console.log('maa setup finished, ', succeeded ? 'succeeded' : 'failed')
  if (succeeded) {
    setup(context)
    activated = true
  }
  return succeeded
}

export async function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand(commands.OpenMaaFolder, async () => {
    await open(context.globalStorageUri.fsPath)
  })

  vscode.commands.registerCommand(commands.LoadMaa, async () => {
    await trySetupMaa(context)
  })

  let retry = 3

  while (retry-- > 0) {
    const succeeded = await trySetupMaa(context)
    if (succeeded) {
      break
    } else {
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

function setup(context: vscode.ExtensionContext) {
  console.log(maa.Global.version)
  maa.Global.debug_mode = true
  const logPath = context.storageUri
  if (logPath) {
    maa.Global.log_dir = logPath.fsPath
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
    PipelineCodeLensProvider,

    ProjectInterfaceLaunchProvider,
    ProjectInterfaceWebProvider
  ])
}

export function deactivate() {
  resetInstance()
}
