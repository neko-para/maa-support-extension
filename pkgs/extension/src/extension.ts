import { defineExtension, useCommand, useOutputChannel } from 'reactive-vscode'
import sms from 'source-map-support'
import vscode from 'vscode'

import { logger, setupLogger } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { loadServices } from './data'
import { maa, setupMaa } from './maa'
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
import { focusAndWaitPanel, initControlPanel, useControlPanel } from './web'
import { ProjectInterfaceCropInstance } from './webview/crop'

sms.install()

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
    const { context } = useControlPanel()
    const cfg = context.value.interfaceConfigObj
    if (cfg) {
      cfg.resource = res
    }
  })

  useCommand(commands.RevealControlPanel, () => {
    focusAndWaitPanel()
  })

  useCommand(commands.OpenCrop, () => {
    new ProjectInterfaceCropInstance().setup()
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

    ProjectInterfaceJsonProvider,
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
