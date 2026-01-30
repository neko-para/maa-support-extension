import sms from 'source-map-support'

import { initMaa } from './maa'
import { initOptions } from './options'
import { initServer } from './server'

sms.install()

async function main() {
  initOptions()
  await initServer()
  initMaa()
}

main()
