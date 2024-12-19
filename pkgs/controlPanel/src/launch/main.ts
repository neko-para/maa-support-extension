import '@vscode-elements/elements'
import { createApp } from 'vue'

import type { LaunchViewContext, LaunchViewFromHost, LaunchViewToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import '@/base.css'
import App from '@/launch/App.vue'
import { stopped, taskList } from '@/launch/states/task'
import type { Message } from '@/launch/types/msg'

export const ipc = useIpc<LaunchViewContext, LaunchViewToHost, LaunchViewFromHost>(() => {
  ipc.log.info('launchView loaded')
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  switch (data.cmd) {
    case 'notify':
      taskList.value.push(data.msg as Message, JSON.parse(data.details))
      break
    case 'stopped':
      stopped.value = true
      break
  }
}
