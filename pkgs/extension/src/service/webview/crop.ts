import path from 'path'
import * as vscode from 'vscode'

import { CropHostState, CropHostToWeb, CropWebToHost, WebToHost } from '@mse/types'
import { WebviewPanelProvider, locale, logger, t } from '@mse/utils'

import { interfaceService, launchService, rootService, stateService } from '..'
import { Jimp } from '../../tools/jimp'
import { performOcr } from '../../tools/ocr'
import { performReco } from '../../tools/reco'
import { currentWorkspace, imageSuffix, isMaaAssistantArknights } from '../../utils/fs'
import { context } from '../context'
import { fromPngDataUrl, toPngDataUrl } from '../utils/png'
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
      iconPath: 'images/logo.png',
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
        const image = Buffer.from(data.image.replace('data:image/png;base64,', ''), 'base64')
        const jimpImage = await Jimp.read(image)
        jimpImage.crop({
          x: data.crop[0],
          y: data.crop[1],
          w: data.crop[2],
          h: data.crop[3]
        })
        const finalImage = await jimpImage.getBuffer('image/png')

        const resource = interfaceService.suggestResource()
        if (!resource) {
          vscode.window.showWarningMessage(t('maa.crop.warning.no-resource'))
          const path = await vscode.window.showSaveDialog({
            filters: {
              Png: ['png']
            },
            defaultUri: currentWorkspace() ?? undefined
          })
          if (path) {
            await vscode.workspace.fs.writeFile(path, finalImage)
          }
          this.response(data.seq, null)
          break
        }
        const imageRoot = vscode.Uri.joinPath(resource, imageSuffix)
        const name = await vscode.window.showInputBox({
          title: t('maa.pi.title.input-image')
        })
        if (!name) {
          this.response(data.seq, null)
          break
        }
        const resultPath = vscode.Uri.joinPath(
          imageRoot,
          stateService.state.cropSettings?.saveAddRoiInfo
            ? `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
            : `${name}.png`
        )
        await vscode.workspace.fs.writeFile(resultPath, finalImage)
        vscode.commands.executeCommand('revealInExplorer', resultPath)
        this.response(data.seq, null)
        break
      }
      case 'requestOCR': {
        const resources = interfaceService.resourcePaths
        if (!resources.length) {
          this.response(data.seq, null)
          return
        }
        let result = null
        try {
          result = await performOcr(
            fromPngDataUrl(data.image),
            data.roi,
            resources.map(u => u.fsPath)
          )
        } catch (err) {
          logger.error(`ocr failed, error ${err}`)
        }
        this.response(data.seq, result)
        break
      }
      case 'requestReco': {
        const resources = interfaceService.resourcePaths
        if (!resources.length) {
          this.response(data.seq, null)
          return
        }
        let result = null
        try {
          result = await performReco(
            Buffer.from(data.image.replace('data:image/png;base64,', ''), 'base64').buffer,
            resources.map(u => u.fsPath)
          )
        } catch (err) {
          logger.error(`reco failed, error ${err}`)
        }
        this.response(data.seq, result)
        break
      }
      case 'writeClipboard':
        vscode.env.clipboard.writeText(data.text)
        break
      case 'updateSettings':
        stateService.reduce({
          cropSettings: {
            ...stateService.state.cropSettings,
            [data.key]: data.value
          }
        })
        this.pushState()
        break
    }
    if (data.builtin) {
      super.recv(data)
    }
  }

  get state(): CropHostState {
    return {
      isMAA: isMaaAssistantArknights,
      locale,

      ...stateService.state.cropSettings
    }
  }

  pushState() {
    this.send({
      command: 'updateState',
      state: this.state
    })
  }
}
