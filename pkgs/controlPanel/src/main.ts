import '@vscode-elements/elements'
import { createApp } from 'vue'

import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'

export const ipc = useIpc<
  {
    counter: number
  },
  never,
  never
>(
  {
    counter: 0
  },
  () => {
    createApp(App).mount('#app')
  }
)
