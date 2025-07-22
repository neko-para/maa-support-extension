import { existsSync, statSync } from 'fs'
import * as fs from 'fs/promises'
import path from 'path'
import { MESSAGE } from 'triple-beam'
import * as vscode from 'vscode'
import { createLogger, format, transports } from 'winston'
import Transport from 'winston-transport'

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

  if (existsSync(file.fsPath)) {
    const stat = statSync(file.fsPath)
    if (stat.size > 10 * 1024 * 1024) {
      await fs.unlink(file.fsPath)
    }
  }

  logger.add(
    new (class VscodeOutputChannelTransport extends Transport {
      log(info: any, next: () => void) {
        channel.appendLine(info[MESSAGE])
        next()
      }
    })({
      level: vscode.workspace.getConfiguration('maa').get('outputLevel') ?? 'info'
    })
  )

  await fs.mkdir(path.dirname(file.fsPath), { recursive: true })
  await fs.appendFile(file.fsPath, '\n' + '-'.repeat(100) + '\n')
  logger.add(
    new transports.File({
      filename: file.fsPath,
      level: 'debug'
    })
  )
}
