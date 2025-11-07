import { enablePatches } from 'immer'
import { createApp } from 'vue'

import App from './App.vue'
import './base.css'
import { initConfig } from './states/config'
import { setup } from './utils/config'

enablePatches()

setup()
initConfig()

createApp(App).mount('#app')
