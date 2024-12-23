import { createApp } from 'vue'

import type { CropViewContext, CropViewFromHost, CropViewToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import '@/base.css'
import App from '@/crop/App.vue'
import * as imageSt from '@/crop/states/image'
import * as ocrSt from '@/crop/states/ocr'

export const ipc = useIpc<CropViewContext, CropViewToHost, CropViewFromHost>(() => {
  ipc.log.info('cropView loaded')
  createApp(App).mount('#app')
})
ipc.handler.value = async data => {
  switch (data.cmd) {
    case 'setImage':
      imageSt.set(data.image)
      break
    case 'decreaseLoading':
      imageSt.loadingCounter.value -= 1
      break
    case 'ocrResult':
      ocrSt.result.value = data.data
      ocrSt.loading.value = false
      break
  }
}
