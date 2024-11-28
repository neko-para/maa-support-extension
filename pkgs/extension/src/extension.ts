import { defineExtension, watch } from 'reactive-vscode'

import { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { createUseWebView } from '@mse/utils'

import { useInterfaceRoot } from './pi/root'

export const useControlPanel = createUseWebView<
  ControlPanelContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

function initControlPanel() {
  const { handler, post } = useControlPanel()
  const { scanInterfaceRoot } = useInterfaceRoot()

  handler.value = data => {
    switch (data.cmd) {
      case 'refreshInterface':
        scanInterfaceRoot()
        break
    }
  }
}

export const { activate, deactivate } = defineExtension(() => {
  initControlPanel()
})
