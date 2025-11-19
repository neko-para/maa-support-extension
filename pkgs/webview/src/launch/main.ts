import { createApp } from 'vue'

import '../utils/base.css'
import { vscodeLocale } from '../utils/locale'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import { launchGraph, reduceLaunchGraph } from './states/launch'

createApp(App).mount('#app')

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      vscodeLocale.value = data.state.locale ?? 'zh'
      break
    case 'notifyStatus':
      launchGraph.value = reduceLaunchGraph(launchGraph.value, data.msg)
      break
  }
}

console.log('LAUNCH: loaded')
