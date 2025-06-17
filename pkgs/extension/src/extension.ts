import { defineExtension, useCommand, useOutputChannel } from 'reactive-vscode'
import sms from 'source-map-support'
import vscode from 'vscode'

import { logger, setupLogger } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { maa, setupMaa } from './maa'
import { init } from './service'
import { WebviewCropPanel } from './service/webview/crop'
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

  if (!setupMaa()) {
    return
  }

  await init(context)

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

  useCommand(commands.OpenCrop, () => {
    new ProjectInterfaceCropInstance(context).setup()
    new WebviewCropPanel('Maa Crop').init()
  })
}

export const { activate, deactivate } = defineExtension(context => {
  setup(context)
})
