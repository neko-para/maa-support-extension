import path from 'path'
import * as vscode from 'vscode'

import { CropHostState, CropHostToWeb, CropWebToHost, WebToHost } from '@mse/types'
import { WebviewPanelProvider, t } from '@mse/utils'

import { interfaceService, launchService, rootService, stateService } from '..'
import { Maa } from '../../maa'
import { context } from '../context'
import { toPngDataUrl } from '../utils/png'
import { isCropDev } from './dev'

export class WebviewCropPanel extends WebviewPanelProvider<CropHostToWeb, CropWebToHost> {
  constructor(title: string, viewColumn?: vscode.ViewColumn) {
    super({
      context,
      folder: 'webview',
      index: 'crop',
      webId: 'maa.view.crop',
      title,
      viewColumn: viewColumn ?? vscode.ViewColumn.Active,
      preserveFocus: false,
      dev: isCropDev
    })
  }

  dispose() {
    console.log('crop panel dispose')
  }

  async recv(data: WebToHost<CropWebToHost>) {
    switch (data.command) {
      case '__init':
        this.pushState()
        break
      case 'requestScreencap':
        if (!rootService.activeResource) {
          this.response(data.seq, null)
          break
        }
        if ((await launchService.updateCache()) && launchService.cache) {
          await launchService.cache.controller.post_screencap().wait()
          const image = launchService.cache.controller.cached_image
          if (!image) {
            this.response(data.seq, null)
            break
          }
          this.response(data.seq, toPngDataUrl(image))
        } else {
          this.response(data.seq, null)
        }
        break
      case 'requestUpload':
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Upload',
          filters: {
            'Png files': ['png']
          },
          defaultUri: stateService.state.uploadDir
            ? vscode.Uri.file(stateService.state.uploadDir)
            : undefined
        }

        const files = await vscode.window.showOpenDialog(options)
        if (!files || files.length === 0) {
          this.response(data.seq, null)
          break
        }

        stateService.reduce({
          uploadDir: path.dirname(files[0].fsPath)
        })

        this.response(data.seq, toPngDataUrl(await vscode.workspace.fs.readFile(files[0])))
        break
      case 'requestSave': {
        const resource = interfaceService.suggestResource()
        if (!resource) {
          vscode.window.showWarningMessage(t('maa.crop.warning.no-resource'))
          const path = await vscode.window.showSaveDialog({
            filters: {
              Png: ['png']
            },
            defaultUri: vscode.workspace.workspaceFolders?.[0].uri
          })
          if (path) {
            await vscode.workspace.fs.writeFile(path, Buffer.from(data.image, 'base64'))
          }
          this.response(data.seq, null)
          break
        }
        const imageRoot = vscode.Uri.joinPath(resource, 'image')
        const name = await vscode.window.showInputBox({
          title: t('maa.pi.title.input-image')
        })
        if (!name) {
          this.response(data.seq, null)
          break
        }
        const resultPath = vscode.Uri.joinPath(
          imageRoot,
          `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
        )
        await vscode.workspace.fs.writeFile(resultPath, Buffer.from(data.image, 'base64'))
        this.response(data.seq, null)
        break
      }
      case 'writeClipboard':
        vscode.env.clipboard.writeText(data.text)
        break
    }
    if (data.builtin) {
      super.recv(data)
    }
  }

  get state(): CropHostState {
    return {}
  }

  pushState() {
    this.send({
      command: 'updateState',
      state: this.state
    })
  }
}
