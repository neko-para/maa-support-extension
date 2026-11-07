import { Buffer } from 'buffer'
import { createApp } from 'vue'

import '../utils/base.css'
import { t, vscodeLocale } from '../utils/locale'
import { syncTooltipFromState } from '../utils/tooltip'
import App from './App.vue'
import { ipc } from './ipc'
import { hostState } from './state'
import * as imageSt from './states/image'
import * as recoSt from './states/reco'
import { revealSection, testTarget } from './states/visible'

globalThis.Buffer = Buffer

createApp(App).mount('#app')

/** 最近一次 setImage 的载入；随后到达的识别详情要挂到这张图上 */
let externalImage: Promise<unknown> = Promise.resolve()

ipc.recv.value = data => {
  switch (data.command) {
    case 'updateState':
      hostState.value = data.state
      vscodeLocale.value = data.state.locale ?? 'zh'
      syncTooltipFromState(data.state)
      break
    case 'setImage':
      externalImage = imageSt.set(data.image).then(ok => {
        if (!ok) {
          imageSt.uploadError.value = t('maa.crop.failure.decode')
        }
      })
      break
    case 'setRecoDetail': {
      const detail = JSON.stringify(data.detail)
      // 外部送来的是节点识别详情，展示在识别测试的「Pipeline 节点」目标下
      testTarget.value = 'node'
      revealSection('test')
      // 图像解码是异步的：等它载入后再挂详情，否则会被切图逻辑当成旧图的结果清掉
      void externalImage.then(() => {
        recoSt.setExternal(detail, imageSt.data.value)
      })
      break
    }
  }
}

ipc.send({
  command: '__init',
  builtin: true
})

console.log('CROP: loaded')
