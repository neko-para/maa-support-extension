import type { ExtToWeb, WebToExt } from '../../types/ipc'
import { recoInfo, showRecoInfo } from './reco'
import { TaskList, taskList } from './task'

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
      break
    case 'launch.notify':
      taskList.value.push(data.msg as any, JSON.parse(data.details))
      break
    case 'show.reco':
      recoInfo.value = data
      showRecoInfo.value = true
      break
  }
})
