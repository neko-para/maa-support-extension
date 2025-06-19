import sms from 'source-map-support'
import vscode from 'vscode'

import { logger, setupLogger } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { maa, setupMaa } from './maa'
import { init } from './service'

sms.install()

export async function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('Maa')
  context.subscriptions.push(channel)

  const logFile = vscode.Uri.joinPath(context.storageUri ?? context.globalStorageUri, 'mse.log')
  await setupLogger(channel, logFile)

  context.subscriptions.push(
    vscode.commands.registerCommand(commands.OpenExtLog, async () => {
      const doc = await vscode.workspace.openTextDocument(logFile)
      if (doc) {
        await vscode.window.showTextDocument(doc)
      }
    })
  )
  if (!(await setupMaa())) {
    return
  }

  await init(context)

  logger.info(`MaaSupport version ${packageJson.version ?? 'dev'}`)
  logger.info(`MaaFramework version ${maa.Global.version}`)
  maa.Global.debug_mode = true
  const logPath = context.storageUri
  if (logPath) {
    maa.Global.log_dir = logPath.fsPath

    context.subscriptions.push(
      vscode.commands.registerCommand(commands.OpenMaaLog, async () => {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(logPath, 'maa.log'))
        if (doc) {
          await vscode.window.showTextDocument(doc)
        }
      })
    )
  }
}

export function deactivate() {}
