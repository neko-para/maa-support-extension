import { setupBase } from './base'
import { setupLsp } from './lsp/connection'
import { setupServer } from './server'

export type MaaLspOption = {
  enableLsp?: boolean
}

export function launch(option: MaaLspOption = {}) {
  if (option.enableLsp) {
    setupLsp()
  }
  setupBase()
  setupServer(60002)
}

launch({
  enableLsp: true
})
