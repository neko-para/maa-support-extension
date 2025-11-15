import { program } from 'commander'
import { existsSync } from 'fs'
import { enablePatches } from 'immer'
import * as path from 'path'
import sms from 'source-map-support'

import { getBrowserImpl } from '@nekosu/native-tools'

import { localStateService, nativeService, setupBase, vscodeService } from './base'
import { setupServer } from './server'

sms.install()
enablePatches()

export async function launch() {
  program
    .option('-p, --port <port>', 'server port', '60002')
    .option('-c, --chdir <chdir>', 'change directory')
    .option('-h, --host <host>', 'vscode host port')
    .option('-q, --quite', 'quite mode')
  program.parse(['node'].concat(process.argv.slice(1)))

  const opts = program.opts<{
    port: string
    chdir?: string
    host?: string
    quite?: boolean
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
  let site: string | undefined = path.resolve(
    path.dirname(process.argv[1]),
    '..',
    'support-webview'
  )
  if (!existsSync(site)) {
    console.log('missing site')
    site = undefined
  }
  setupServer(port, site)

  let hostPort = opts.host ? parseInt(opts.host) : null
  if (typeof hostPort === 'number' && isNaN(hostPort)) {
    hostPort = null
  }
  if (hostPort) {
    vscodeService.setup(hostPort)
  }

  if (site && !opts.quite && !vscodeService.loaded) {
    getBrowserImpl().openUrl(`http://localhost:${port}?maa_port=${port}`)
  }

  console.log('preparing maaframework...')
  if (await nativeService.load()) {
    maa.Global.log_dir = path.join(localStateService.folder, 'log')
    console.log('preparing maaframework done')
  } else {
    console.log('preparing maaframework failed')
  }
}

launch()
