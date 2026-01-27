import { initMaa } from './maa'
import { initServer } from './server'

async function main() {
  initMaa()
  await initServer()
}

main()
