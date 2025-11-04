import child_process from 'child_process'
import net from 'net'
import * as path from 'path'
import * as vscode from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StreamInfo,
  Trace,
  TransportKind
} from 'vscode-languageclient/node'
import { DidOpenTextDocumentParams } from 'vscode-languageserver-protocol'

import { logger } from '@mse/utils'

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

export function activateLsp(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('lsp', 'index.js'))

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
        const cp = child_process.fork(serverModule, [], {
          cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? context.globalStorageUri.fsPath,
          stdio: 'pipe'
        })
        cp.on('close', () => {
          logger.info(`lsp close`)
        })
        cp.stdout?.on('data', data => {
          logger.info(`lsp stdout: ${data}`)
        })
        cp.stderr?.on('data', data => {
          logger.info(`lsp stderr: ${data}`)
        })
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
