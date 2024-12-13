import { MESSAGE } from 'triple-beam'
import * as vscode from 'vscode'
import { createLogger, format, transports } from 'winston'
import Transport from 'winston-transport'

import { vscfs } from './fs'

export const logger = createLogger({
  transports: [
    new transports.Console({
      level: 'silly'
    })
  ],
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss:SSS'
    }),
    format.printf(info => `[${info.timestamp}][${info.level.toUpperCase()}] ${info.message}`)
  ),
  exitOnError: false
})

export let loggerChannel: vscode.OutputChannel

export async function setupLogger(channel: vscode.OutputChannel, file: vscode.Uri) {
  loggerChannel = channel

  if (await vscfs.exists(file)) {
    const stat = await vscfs.stat(file)
    if (stat.size > 10 * 1024 * 1024) {
      await vscfs.delete(file)
    }
  }

  logger.add(
    new (class VscodeOutputChannelTransport extends Transport {
      log(info: any, next: () => void) {
        channel.appendLine(info[MESSAGE])
        next()
      }
    })({
      level:
        vscode.workspace.getConfiguration('nekosu.maa-support').get('maa.outputLevel') ?? 'info'
    })
  )
  logger.add(
    new transports.File({
      filename: file.fsPath,
      level: 'debug'
    })
  )
}
