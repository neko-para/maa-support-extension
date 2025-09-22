import sms from 'source-map-support'
import vscode from 'vscode'

import { logger, setupLogger, t } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { maa } from './maa'
import { init, nativeService, statusBarService } from './service'
import { maaEvalTask } from './utils/eval/eval'
import { MaaTaskExpr } from './utils/eval/types'
import { checkMaaAssistantArknights, isMaaAssistantArknights } from './utils/fs'

sms.install()

export async function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel('Maa')
  context.subscriptions.push(channel)

  const logFile = vscode.Uri.joinPath(context.storageUri ?? context.globalStorageUri, 'mse.log')
  await setupLogger(channel, logFile)

  context.subscriptions.push(
    vscode.commands.registerCommand(commands.OpenExtLog, async () => {
      try {
        const doc = await vscode.workspace.openTextDocument(logFile)
        await vscode.window.showTextDocument(doc)
      } catch {
        vscode.window.showErrorMessage(t('maa.core.cannot-find-log', logFile.fsPath))
      }
    })
  )

  checkMaaAssistantArknights()

  if (isMaaAssistantArknights) {
    logger.info('MaaAssistantArknights mode')

    vscode.commands.executeCommand('setContext', 'maa.maa-mode', true)
  }

  await init(context)

  if (!(await nativeService.load())) {
    vscode.window.showErrorMessage(t('maa.core.load-maafw-failed'))
    statusBarService.showMaaStatus(null)
    return
  }

  statusBarService.showMaaStatus(nativeService.version)

  logger.info(`MaaSupport version ${packageJson.version ?? 'dev'}`)
  logger.info(`MaaFramework version ${maa.Global.version}`)
  maa.Global.debug_mode = true
  const logPath = context.storageUri
  if (logPath) {
    maa.Global.log_dir = logPath.fsPath

    context.subscriptions.push(
      vscode.commands.registerCommand(commands.OpenMaaLog, async () => {
        const maaLogFile = vscode.Uri.joinPath(logPath, 'maa.log')
        try {
          const doc = await vscode.workspace.openTextDocument(maaLogFile)
          await vscode.window.showTextDocument(doc)
        } catch {
          vscode.window.showErrorMessage(t('maa.core.cannot-find-log', maaLogFile.fsPath))
        }
      })
    )
  }
}

export function deactivate() {}
