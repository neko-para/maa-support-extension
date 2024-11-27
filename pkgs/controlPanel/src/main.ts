import '@vscode-elements/elements'
import { createApp } from 'vue'

import { useIpc } from '@mse/web-utils'

import App from '@/App.vue'

import type { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '../../types/src'

export const ipc = useIpc<ControlPanelContext, ControlPanelToHost, ControlPanelFromHost>({}, () => {
  createApp(App).mount('#app')
})
