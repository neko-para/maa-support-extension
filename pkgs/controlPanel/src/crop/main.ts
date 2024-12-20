import { createApp } from 'vue'

import type { CropViewContext, CropViewFromHost, CropViewToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import '@/base.css'
import App from '@/crop/App.vue'
import * as imageSt from '@/crop/states/image'

export const ipc = useIpc<CropViewContext, CropViewToHost, CropViewFromHost>(() => {
  ipc.log.info('cropView loaded')
  createApp(App).mount('#app')
})
ipc.handler.value = async data => {
  switch (data.cmd) {
    case 'setImage':
      imageSt.set(data.image)
      break
  }
}
