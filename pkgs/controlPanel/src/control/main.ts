import { createApp } from 'vue'

import type { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import '@/base.css'
import App from '@/control/App.vue'
import * as interfaceSt from '@/control/states/interface'
import * as runtimeSt from '@/control/states/runtime'

export const ipc = useIpc<ControlPanelContext, ControlPanelToHost, ControlPanelFromHost>(() => {
  ipc.log.info('controlPanel loaded')
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  switch (data.cmd) {
    case 'launchInterface':
      if (runtimeSt.runtime.value[0]) {
        interfaceSt.launchRuntime(runtimeSt.runtime.value[0])
      }
      break
    case 'launchTask': {
      const rt = runtimeSt.runtimeForTask(data.task)
      if (rt) {
        interfaceSt.launchRuntime(rt)
      }
      break
    }
  }
}
