import { createApp } from 'vue'

import '../utils/base.css'
import { vscodeLocale } from '../utils/locale'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import { analyzerBridge } from './states/analyzer'

analyzerBridge.start()
window.addEventListener('beforeunload', () => {
  analyzerBridge.dispose()
})

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      vscodeLocale.value = data.state.locale ?? 'zh'
      break
    case 'realtimeStart':
      analyzerBridge.onRealtimeStart(data.params)
      break
    case 'realtimeEnd':
      analyzerBridge.onRealtimeEnd(data.params)
      break
    case 'notifyStatus':
      analyzerBridge.onNotifyStatus(data.msg)
      break
  }
}

console.log('LAUNCH: loaded')
