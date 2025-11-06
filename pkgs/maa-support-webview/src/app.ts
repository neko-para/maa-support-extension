import { createApp } from 'vue'

import App from './App.vue'
import './base.css'
import { setup } from './utils/config'

setup()

createApp(App).mount('#app')
