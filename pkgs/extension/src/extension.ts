import { defineExtension } from 'reactive-vscode'

import { createUseWebView } from '@mse/utils'

const useWeb = createUseWebView('controlPanel', 'maa.view.control-panel', { counter: 0 })

export const { activate, deactivate } = defineExtension(() => {
  useWeb()
})
