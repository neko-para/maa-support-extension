import { enablePatches } from 'immer'
import sms from 'source-map-support'

import { nativeService, setupBase } from './base'
import { setupServer } from './server'

sms.install()
enablePatches()

export async function launch() {
  await setupBase()
  setupServer(60002)

  await nativeService.load()
}

launch()
