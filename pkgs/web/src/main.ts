import 'jimp/browser/lib/jimp.js'
import { createApp } from 'vue'

import type { OldWebContext, OldWebFromHost, OldWebToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'
import '@/base.css'

import { fulfillImage } from './crop/crop'
import { activePage } from './data'

export const ipc = useIpc<OldWebContext, OldWebToHost, OldWebFromHost>(() => {
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  console.log('Maa.Webview:', data)
  switch (data.cmd) {
    case 'crop.setup':
      activePage.value = 'crop'
      break
    case 'crop.image':
      fulfillImage(data.image)
      break
  }
}
