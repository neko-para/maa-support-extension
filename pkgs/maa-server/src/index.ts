import { initMaa } from './maa'
import { initServer } from './server'

async function main() {
  console.log(process.argv.slice(2))
  await initServer()
  initMaa()
}

main()
