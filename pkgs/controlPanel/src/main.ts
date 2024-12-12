import '@vscode-elements/elements'
import { createApp } from 'vue'

import type { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'
import '@/base.css'
import * as interfaceSt from '@/states/interface'
import * as runtimeSt from '@/states/runtime'

export const ipc = useIpc<ControlPanelContext, ControlPanelToHost, ControlPanelFromHost>(() => {
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  switch (data.cmd) {
    case 'launchTask': {
      const rt = runtimeSt.runtimeForTask(data.task)
      if (rt) {
        interfaceSt.launchRuntime(rt)
      }
      break
    }
  }
}
