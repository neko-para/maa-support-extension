import { createApp } from 'vue'

import '../utils/base.css'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import * as imageSt from './states/image'

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      break
    case 'setImage':
      imageSt.set(data.image)
      break
  }
}

console.log('CROP: loaded')
