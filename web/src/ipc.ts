import type { ExtToWeb } from '../../types/ipc'
import { TaskList, taskList } from './task'

const vscode = acquireVsCodeApi()

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
  }
})
