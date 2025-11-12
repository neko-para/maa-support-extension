import { program } from 'commander'
import { enablePatches } from 'immer'
import sms from 'source-map-support'

import { nativeService, setupBase, vscodeService } from './base'
import { setupServer } from './server'

sms.install()
enablePatches()

export async function launch() {
  program
    .option('-p, --port <port>', 'server port', '60002')
    .option('-c, --chdir <chdir>', 'change directory')
    .option('-h, --host <host>', 'vscode host port')
  program.parse(['node'].concat(process.argv.slice(1)))

  const opts = program.opts<{
    port: string
    chdir?: string
    host?: string
  }>()
  const args = program.args

  console.log(opts, args)

  let port = parseInt(opts.port)
  if (isNaN(port)) {
    port = 60002
  }

  if (opts.chdir) {
    process.chdir(opts.chdir)
  }

  await setupBase()
  setupServer(port)

  let hostPort = opts.host ? parseInt(opts.host) : null
  if (typeof hostPort === 'number' && isNaN(hostPort)) {
    hostPort = null
  }
  vscodeService.hostPort = hostPort

  console.log('preparing maaframework...')
  if (await nativeService.load()) {
    console.log('preparing maaframework done')
  } else {
    console.log('preparing maaframework failed')
  }
}

launch()
