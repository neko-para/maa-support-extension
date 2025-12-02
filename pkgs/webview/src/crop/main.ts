import { Buffer } from 'buffer'
import { createApp } from 'vue'

import '../utils/base.css'
import { vscodeLocale } from '../utils/locale'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import * as imageSt from './states/image'

// @ts-ignore
globalThis.Buffer = Buffer

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      vscodeLocale.value = data.state.locale ?? 'zh'
      break
    case 'setImage':
      imageSt.set(data.image)
      break
  }
}

console.log('CROP: loaded')
