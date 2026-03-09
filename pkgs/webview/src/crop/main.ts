import { Buffer } from 'buffer'
import { createApp } from 'vue'

import '../utils/base.css'
import { vscodeLocale } from '../utils/locale'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import * as imageSt from './states/image'
import * as recoSt from './states/reco'
import { showTab } from './states/visible'

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
    case 'setRecoDetail':
      recoSt.result.value = JSON.stringify(data.detail)
      showTab.value = 'tool'
      break
  }
}

console.log('CROP: loaded')
