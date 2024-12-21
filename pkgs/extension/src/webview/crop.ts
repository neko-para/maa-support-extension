import path from 'path'
import * as vscode from 'vscode'

import { CropViewFromHost } from '@mse/types'
import { t } from '@mse/utils'

import { sharedInstance } from '../data'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { ProjectInterfaceJsonProvider } from '../projectInterface/json'
import { ProjectInterfaceLaunchProvider } from '../projectInterface/launcher'
import { useCropView } from '../web'
import { toPngDataUrl } from './utils'

export class ProjectInterfaceCropInstance {
  post: (data: CropViewFromHost) => void = () => {}

  async setup() {
    const { onDidDispose, post, handler, context } = await useCropView()
    this.post = post
    onDidDispose.push(() => {
      this.dispose()
    })
    handler.value = async data => {
      switch (data.cmd) {
        case 'requestScreencap': {
          if (!sharedInstance(PipelineRootStatusProvider).activateResource.value) {
            post({
              cmd: 'decreaseLoading'
            })
            break
          }
          const pilp = sharedInstance(ProjectInterfaceLaunchProvider)

          if ((await pilp.updateCache()) && pilp.cache) {
            await pilp.cache.controller.post_screencap().wait()
            const image = pilp.cache.controller.cached_image
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
          const root = sharedInstance(ProjectInterfaceJsonProvider).suggestResource()
          if (!root) {
            post({
              cmd: 'decreaseLoading'
            })
            return
          }
          const imageRoot = vscode.Uri.joinPath(root, 'image')
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
      }
    }
  }

  async dispose() {}
}
