import { HostApiMeta } from '@maaxyz/maa-support-types'
import express, { type Express, json } from 'express'
import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { WebviewPanel } from './panel'

let app: Express

export function handle<Path extends keyof HostApiMeta>(
  path: Path,
  func: (
    req: HostApiMeta[Path]['req']
  ) => HostApiMeta[Path]['rsp'] | Promise<HostApiMeta[Path]['rsp']>
) {
  app.post(`/${path}`, async (req, rsp) => {
    const result = await func(req.body)
    rsp.send(result)
  })
}

export function setupServer(port: number, context: vscode.ExtensionContext) {
  app = express()

  app.use(json())

  app.use((req, rsp, next) => {
    logger.info(`--> ${req.path}`)
    next()
  })

  const data = new Map<string, unknown>()

  handle('addPage', req => {
    const panel = new WebviewPanel(context, req.type, req.id, req.type)
    data.set(req.id, req.data)
    panel.init()
    return {
      succ: false
    }
  })

  handle('getPageData', req => {
    const ret = data.get(req.id)
    data.delete(req.id)
    return {
      data: ret
    }
  })

  handle('nativeOpenFile', async req => {
    const result = await vscode.window.showOpenDialog({
      title: req.option.title,
      defaultUri: req.option.defaultFolder ? vscode.Uri.file(req.option.defaultFolder) : undefined,
      canSelectMany: req.option.multi
    })
    return {
      files: result?.map(uri => uri.fsPath) ?? null
    }
  })

  handle('nativeSaveFile', async req => {
    const result = await vscode.window.showSaveDialog({
      title: req.option.title,
      defaultUri: req.option.defaultFolder ? vscode.Uri.file(req.option.defaultFolder) : undefined
    })
    return {
      files: result?.fsPath ?? null
    }
  })

  handle('nativeOpenFolder', async req => {
    const result = await vscode.window.showOpenDialog({
      title: req.option.title,
      defaultUri: req.option.defaultFolder ? vscode.Uri.file(req.option.defaultFolder) : undefined,
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: req.option.multi
    })
    return {
      files: result?.map(uri => uri.fsPath) ?? null
    }
  })

  handle('nativeOpenUrl', async req => {
    vscode.env.openExternal(vscode.Uri.parse(req.url))
  })

  const server = app.listen(port)

  context.subscriptions.push({
    dispose() {
      server.close()
    }
  })
}
