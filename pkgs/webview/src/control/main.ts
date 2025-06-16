import { createApp } from 'vue'

import '../utils/base.css'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      break
  }
}

console.log('CONTROL: loaded')
