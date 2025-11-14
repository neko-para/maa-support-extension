import child_process from 'child_process'
import net from 'net'
import * as path from 'path'
import * as vscode from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StreamInfo
} from 'vscode-languageclient/node'
import { DidOpenTextDocumentParams } from 'vscode-languageserver-protocol'

import { logger } from '@mse/utils'

import { setupServer } from './host'
import { request } from './utils'

let client: LanguageClient

function traceSocket(socket: net.Socket) {
  socket.on('data', data => {
    const buf = data.toString()
    const json = buf.replace(/^Content-Length: \d+\r\n\r\n/, '')
    try {
      const obj = JSON.parse(json) as { result?: unknown }
      logger.info(`<-- ${JSON.stringify(obj.result)}`)
    } catch {}
  })

  const oldWrite = socket.write.bind(socket)
  socket.write = (data, ...args) => {
    let str = data
    if (typeof str !== 'string') {
      str = str.toString()
    }
    if (str.startsWith('{')) {
      try {
        const obj = JSON.parse(str) as {
          method: string
          params?: unknown
        }
        if (obj.method === 'textDocument/didOpen') {
          const params = obj.params as DidOpenTextDocumentParams
          logger.info(`--> ${obj.method} ${params.textDocument.uri}`)
        } else {
          logger.info(`--> ${obj.method}`)
        }
      } catch {}
    }

    return (oldWrite as any)(data, ...args)
  }
}

function initServer(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('support', 'index.js'))

  const cp = child_process.fork(serverModule, ['--host', '60005', '--quite'], {
    cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? context.globalStorageUri.fsPath,
    stdio: 'pipe'
  })
  cp.on('close', () => {
    logger.info(`support close`)
  })
  cp.stdout?.on('data', data => {
    logger.info(`support stdout: ${data}`)
  })
  cp.stderr?.on('data', data => {
    logger.info(`support stderr: ${data}`)
  })

  context.subscriptions.push({
    dispose() {
      cp.kill()
    }
  })

  setupServer(60005, context)
}

export function activateLsp(context: vscode.ExtensionContext) {
  initServer(context)

  let serverOptions: ServerOptions = () => {
    return new Promise<StreamInfo>(resolve => {
      const server = net.createServer(socket => {
        server.close()
        traceSocket(socket)
        resolve({
          writer: socket,
          reader: socket
        })
      })
      server.listen(60001, () => {
        request('/lsp/start', { port: 60001 })
      })
    })
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'json' },
      { scheme: 'file', language: 'jsonc' }
    ]
  }

  client = new LanguageClient('MaaClient', 'MaaClient', serverOptions, clientOptions)

  client.start()
}
