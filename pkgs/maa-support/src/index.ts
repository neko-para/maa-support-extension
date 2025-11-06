import { enablePatches } from 'immer'

import { nativeService, setupBase } from './base'
import { setupLsp } from './lsp/connection'
import { setupServer } from './server'

enablePatches()

export type MaaLspOption = {
  lsp?: {
    port: number
  }
}

export async function launch(option: MaaLspOption = {}) {
  await setupBase()
  setupServer(60002)

  await nativeService.load()

  if (option.lsp) {
    setupLsp(option.lsp.port)
  }
}

launch({
  lsp: {
    port: 60001
  }
})
