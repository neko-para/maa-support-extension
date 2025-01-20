import { setupDevelop } from '@nekosu/vscode-web'
import { createApp } from 'vue'

import App from '@/App.vue'

setupDevelop().then(ctx => {
  ctx[2]('print', 1, '2').then(ret => {
    console.log(ret)
  })
  createApp(App).mount('#app')
})
