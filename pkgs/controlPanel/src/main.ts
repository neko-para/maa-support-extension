import '@vscode-elements/elements'
import { createApp } from 'vue'

import type { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'
import '@/base.css'

export const ipc = useIpc<ControlPanelContext, ControlPanelToHost, ControlPanelFromHost>(() => {
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  // switch (data.cmd) {
  // }
}
