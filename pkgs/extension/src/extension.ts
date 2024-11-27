import { defineExtension, watch } from 'reactive-vscode'

import {
  ControlPanelFromHost,
  ControlPanelHostContext,
  ControlPanelToHost,
  ControlPanelWebvContext
} from '@mse/types'
import { createUseWebView } from '@mse/utils'

import { useInterface } from './pi/state'

export const useControlPanel = createUseWebView<
  ControlPanelHostContext,
  ControlPanelWebvContext,
  ControlPanelToHost,
  ControlPanelFromHost
>('controlPanel', 'maa.view.control-panel')

function initControlPanel() {
  const { handler, post } = useControlPanel()
  const { scanInterface } = useInterface()

  handler.value = data => {
    switch (data.cmd) {
      case 'refreshInterface':
        scanInterface()
        break
    }
  }
}

export const { activate, deactivate } = defineExtension(() => {
  initControlPanel()
})
