import { defineExtension } from 'reactive-vscode'

import { ControlPanelContext, ControlPanelFromHost, ControlPanelToHost } from '@mse/types'
import { createUseWebView } from '@mse/utils'

const useWeb = createUseWebView<ControlPanelContext, ControlPanelToHost, ControlPanelFromHost>(
  'controlPanel',
  'maa.view.control-panel',
  {
    counter: 0
  }
)

export const { activate, deactivate } = defineExtension(() => {
  useWeb()
})
