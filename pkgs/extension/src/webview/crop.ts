import path from 'path'
import * as vscode from 'vscode'

import { CropViewFromHost } from '@mse/types'
import { logger, t } from '@mse/utils'

import { interfaceService, launchService, rootService } from '../service'
import { toPngDataUrl } from '../service/utils/png'
import { performOcr } from '../tools/ocr'
import { performReco } from '../tools/reco'
import { useCropView } from '../web'

export class ProjectInterfaceCropInstance {
  __context: vscode.ExtensionContext

  post: (data: CropViewFromHost) => void = () => {}

  constructor(context: vscode.ExtensionContext) {
    this.__context = context
  }

  async setup(initImage?: string) {
    const { onDidDispose, post, handler, context, awaked } = await useCropView()
    await awaked
    this.post = post
    onDidDispose.push(() => {
      this.dispose()
    })
    handler.value = async data => {
      switch (data.cmd) {
        case 'requestScreencap': {
          if (!rootService.activeResource) {
            post({
              cmd: 'decreaseLoading'
            })
            break
          }
          if ((await launchService.updateCache()) && launchService.cache) {
            await launchService.cache.controller.post_screencap().wait()
            const image = launchService.cache.controller.cached_image
            if (!image) {
              return
            }
            post({
              cmd: 'setImage',
              image: toPngDataUrl(image)
            })
          }
          post({
            cmd: 'decreaseLoading'
          })
          break
        }
        case 'requestUpload': {
          const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Upload',
            filters: {
              'Png files': ['png']
            },
            defaultUri: context.value.uploadDir
              ? vscode.Uri.file(context.value.uploadDir)
              : undefined
          }

          const files = await vscode.window.showOpenDialog(options)
          if (!files || files.length === 0) {
            post({
              cmd: 'decreaseLoading'
            })
            break
          }

          context.value.uploadDir = path.dirname(files[0].fsPath)

          const data = await vscode.workspace.fs.readFile(files[0])
          post({
            cmd: 'setImage',
            image: toPngDataUrl(data)
          })
          post({
            cmd: 'decreaseLoading'
          })
          break
        }
        case 'requestSave':
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
            post({
              cmd: 'decreaseLoading'
            })
            return
          }
          const imageRoot = vscode.Uri.joinPath(resource, 'image')
          const name = await vscode.window.showInputBox({
            title: t('maa.pi.title.input-image')
          })
          if (!name) {
            post({
              cmd: 'decreaseLoading'
            })
            return
          }
          const resultPath = vscode.Uri.joinPath(
            imageRoot,
            `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
          )
          await vscode.workspace.fs.writeFile(resultPath, Buffer.from(data.image, 'base64'))
          post({
            cmd: 'decreaseLoading'
          })
          break
        case 'requestOCR': {
          const resources = interfaceService.resourcePaths
          if (!resources.length) {
            post({
              cmd: 'ocrResult',
              data: null
            })
            return
          }
          let result = null
          try {
            result = await performOcr(
              Buffer.from(data.image.replace('data:image/png;base64,', ''), 'base64').buffer,
              data.roi,
              resources.map(u => u.fsPath)
            )
          } catch (err) {
            logger.error(`ocr failed, error ${err}`)
          }
          post({
            cmd: 'ocrResult',
            data: result
          })
          break
        }
        case 'requestReco': {
          const resources = interfaceService.resourcePaths
          if (!resources.length) {
            post({
              cmd: 'recoResult',
              data: null
            })
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
          post({
            cmd: 'recoResult',
            data: result
          })
          break
        }
      }
    }

    if (initImage) {
      post({
        cmd: 'setImage',
        image: initImage
      })
    }
  }

  async dispose() {}
}
