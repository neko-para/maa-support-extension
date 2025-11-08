import { enablePatches } from 'immer'
import { createApp } from 'vue'

import App from './App.vue'
import './base.css'
import { initConfig } from './states/config'
import { isVscode, setup } from './utils/config'
import { trackVscodeTheme } from './utils/vscode'

enablePatches()

setup()

if (isVscode) {
  trackVscodeTheme()
}

initConfig()

createApp(App).mount('#app')
