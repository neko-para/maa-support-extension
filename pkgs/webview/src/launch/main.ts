import { createApp } from 'vue'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

import '../utils/base.css'
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
      break
    case 'notifyStatus':
      taskList.value.push(data.msg as Message, JSON.parse(data.details))
      break
  }
}

console.log('LAUNCH: loaded')
