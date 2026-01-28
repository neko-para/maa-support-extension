import { initMaa } from './maa'
import { initOptions } from './options'
import { initServer } from './server'

async function main() {
  initOptions()
  await initServer()
  initMaa()
}

main()
