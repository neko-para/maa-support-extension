import { createApp } from 'vue'

import '../utils/base.css'
import { vscodeLocale } from '../utils/locale'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import type { Message } from './states/msg'
import { taskList } from './states/task'

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      vscodeLocale.value = data.state.locale ?? 'zh'
      break
    case 'notifyStatus':
      taskList.value.push(data.msg as Message, JSON.parse(data.details))
      break
  }
}

console.log('LAUNCH: loaded')
