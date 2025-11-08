import { program } from 'commander'
import { enablePatches } from 'immer'
import sms from 'source-map-support'

import { nativeService, setupBase } from './base'
import { setupServer } from './server'

sms.install()
enablePatches()

export async function launch() {
  program
    .option('-p, --port <port>', 'server port', '60002')
    .option('-c, --chdir <chdir>', 'change directory')
  program.parse(process.argv.slice(2))

  const opts = program.opts<{
    port: string
    chdir?: string
  }>()
  const args = program.args

  // console.log(process.argv, process.argv0, opts, args)

  let port = parseInt(opts.port)
  if (isNaN(port)) {
    port = 60002
  }

  if (opts.chdir) {
    process.chdir(opts.chdir)
  }

  await setupBase()
  setupServer(port)

  console.log('preparing maaframework...')
  if (await nativeService.load()) {
    console.log('preparing maaframework done')
  } else {
    console.log('preparing maaframework failed')
  }
}

launch()
