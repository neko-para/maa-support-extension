import { setupBase } from './base'
import { setupLsp } from './lsp/connection'

export type MaaLspOption = {
  enableLsp?: boolean
}

export function launch(option: MaaLspOption = {}) {
  if (option.enableLsp) {
    setupLsp()
  }
  setupBase()
}

launch({
  enableLsp: true
})
