import * as maa from '@nekosu/maa-node'
import * as vscode from 'vscode'

import type { ExtToWeb, WebToExt } from '../../types/ipc'
import { commands } from '../command'
import { Service } from '../data'
import { t } from '../locale'
import { PipelineProjectInterfaceProvider } from '../pipeline/pi'
import { PipelineRootStatusProvider } from '../pipeline/root'
import { ProjectInterfaceLaunchProvider } from './launcher'

function toPngDataUrl(buffer: ArrayBuffer) {
  return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
}

export class ProjectInterfaceWebProvider extends Service {
  panel: vscode.WebviewPanel | null

  constructor(context: vscode.ExtensionContext) {
    super(context)

    this.panel = null

    this.defer = vscode.commands.registerCommand(commands.OpenWeb, async () => {
      ;(await this.acquire()).reveal()
    })
  }

  acquire(create?: true): Promise<vscode.WebviewPanel>
  acquire(create: false): Promise<vscode.WebviewPanel | null>
  acquire(create: boolean): Promise<vscode.WebviewPanel | null>
  async acquire(create = true) {
    if (!this.panel && create) {
      const rootUri = vscode.Uri.file(this.__context.asAbsolutePath('web'))

      this.panel = vscode.window.createWebviewPanel(
        'maa.Webview',
        'Maa Support',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          localResourceRoots: [rootUri],
          retainContextWhenHidden: true
        }
      )
      this.panel.onDidDispose(() => {
        this.panel = null
      })
      const content = Buffer.from(
        await vscode.workspace.fs.readFile(vscode.Uri.joinPath(rootUri, 'index.html'))
      )
        .toString()
        .replaceAll('/@ROOT@', this.panel.webview.asWebviewUri(rootUri).toString())
      this.panel.webview.html = content

      this.panel.webview.onDidReceiveMessage(async (data: WebToExt) => {
        switch (data.cmd) {
          case 'launch.reco':
            const info = new maa.RecoInfo(data.reco as maa.RecoId)
            const raw = new maa.ImageBuffer()
            const draws = new maa.ImageListBuffer()
            const detailInfo = info.detail(raw, draws)
            if (!detailInfo) {
              return
            }
            detailInfo.detail_json = JSON.stringify(JSON.parse(detailInfo.detail_json), null, 4)
            this.post({
              cmd: 'show.reco',
              raw: toPngDataUrl(raw.encoded),
              draws: Array.from({ length: draws.size }, (_, i) =>
                toPngDataUrl(draws.at(i).encoded)
              ),
              info: detailInfo
            })
            return
          case 'crop.screencap':
            if (!this.shared(PipelineRootStatusProvider).activateResource) {
              return
            }
            const pilp = this.shared(ProjectInterfaceLaunchProvider)
            const runtime = await pilp.prepareRuntime(
              this.shared(PipelineRootStatusProvider).activateResource!.dirUri.fsPath
            )
            if (!runtime) {
              return
            }
            if (!(await pilp.setupInstance(runtime, true)) || !pilp.instance) {
              return
            }
            await maa.controller_wait(
              pilp.instance.controller.handle,
              maa.controller_post_screencap(pilp.instance.controller.handle)
            )
            const image = new maa.ImageBuffer()
            if (!maa.controller_get_image(pilp.instance.controller.handle, image.handle)) {
              return
            }
            this.post({
              cmd: 'crop.image',
              image: toPngDataUrl(image.encoded)
            })
            break
          case 'crop.upload': {
            const options: vscode.OpenDialogOptions = {
              canSelectMany: false,
              openLabel: 'Upload',
              filters: {
                'Png files': ['png']
              }
            }

            const files = await vscode.window.showOpenDialog(options)
            if (!files || files.length === 0) {
              break
            }

            const data = await vscode.workspace.fs.readFile(files[0])
            this.post({
              cmd: 'crop.image',
              image: toPngDataUrl(data)
            })
            break
          }
          case 'crop.download':
            const root = this.shared(PipelineProjectInterfaceProvider).suggestResource()
            if (!root) {
              return
            }
            const imageRoot = vscode.Uri.joinPath(root, 'image')
            const name = await vscode.window.showInputBox({
              title: t('maa.pi.title.input-image')
            })
            if (!name) {
              return
            }
            const resultPath = vscode.Uri.joinPath(
              imageRoot,
              `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
            )
            await vscode.workspace.fs.writeFile(resultPath, Buffer.from(data.image, 'base64'))
            break
        }
      })
    }
    return this.panel
  }

  async post(msg: ExtToWeb, create = true) {
    return await (await this.acquire(create))?.webview.postMessage(msg)
  }
}
