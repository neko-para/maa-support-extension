import * as path from 'node:path'
import { createServer as viteWatch } from 'vite'

import { buildChain, watchChain } from './utils.mjs'

buildChain(['pkgs/simple-parser', 'pkgs/maa-tasker']).then(() => {
  watchChain([
    'pkgs/maa-version-manager',
    'pkgs/maa-pipeline-manager',
    'pkgs/maa-locale',

    'pkgs/extension',
    'pkgs/maa-tools',
    'pkgs/prettier-plugin-maafw-sort',
    'pkgs/maa-server'
  ])
})

viteWatch({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  mode: 'development'
}).then(async server => {
  await server.listen()
  server.printUrls()
})
