import type { ExtToWeb, WebToExt } from '../../types/ipc'
import { fulfillImage } from './crop/crop'
import { activePage } from './data'
import { recoInfo, showRecoInfo } from './launch/reco'
import { TaskList, taskList } from './launch/task'

const vscode = acquireVsCodeApi()

export function send(msg: WebToExt) {
  vscode.postMessage(msg)
}

window.addEventListener('message', event => {
  const data = event.data as ExtToWeb
  console.log('Maa.Webview:', data)
  switch (data.cmd) {
    case 'launch.setup':
      taskList.value = new TaskList()
      activePage.value = 'launch'
      break
    case 'launch.notify':
      taskList.value.push(data.msg as any, JSON.parse(data.details))
      break
    case 'show.reco':
      recoInfo.value = data
      showRecoInfo.value = true
      break
    case 'crop.setup':
      activePage.value = 'crop'
      break
    case 'crop.image':
      fulfillImage(data.image)
      break
  }
})
