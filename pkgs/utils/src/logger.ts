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

export function setupLogger(channel: vscode.OutputChannel, file: vscode.Uri) {
  loggerChannel = channel

  logger.add(
    new (class VscodeOutputChannelTransport extends Transport {
      log(info: any, next: () => void) {
        channel.appendLine(info[MESSAGE])
        next()
      }
    })()
  )
  logger.add(
    new transports.File({
      filename: file.fsPath,
      level: 'debug'
    })
  )
}
