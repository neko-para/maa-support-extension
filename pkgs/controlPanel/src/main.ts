import '@vscode-elements/elements'
import { computed, createApp } from 'vue'

import type {
  ControlPanelFromHost,
  ControlPanelHostContext,
  ControlPanelToHost,
  ControlPanelWebvContext
} from '@mse/types'
import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'

export const ipc = useIpc<
  ControlPanelHostContext,
  ControlPanelWebvContext,
  ControlPanelToHost,
  ControlPanelFromHost
>(() => {
  createApp(App).mount('#app')
})

ipc.handler.value = data => {
  // switch (data.cmd) {
  // }
}
