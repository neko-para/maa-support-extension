import os from 'os'
import sms from 'source-map-support'
import vscode from 'vscode'

import { setLocale, t } from '@mse/locale'
import { logger, setupLogger } from '@mse/utils'

import packageJson from '../../../release/package.json'
import { commands } from './command'
import { init, nativeService, statusBarService } from './service'
import { checkMaaAssistantArknights, isMaaAssistantArknights } from './utils/fs'

sms.install()

export async function activate(context: vscode.ExtensionContext) {
  setLocale(vscode.env.language.startsWith('zh') ? 'zh' : 'en')

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

  logger.info(`Running as ${os.userInfo().username}`)

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

  const logPath = context.storageUri ?? context.globalStorageUri

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

export function deactivate() {}
