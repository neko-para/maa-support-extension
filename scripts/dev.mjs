import * as path from 'node:path'
import { createServer as viteWatch } from 'vite'

import { buildChain, watchChain } from './utils.mjs'

buildChain(['pkgs/simple-parser', 'pkgs/maa-tasker']).then(() => {
  watchChain([
    'pkgs/maa-version-manager',
    'pkgs/maa-pipeline-manager',
    'pkgs/maa-locale',

    'pkgs/maa-server',
    'pkgs/maa-tools',
    'pkgs/extension',

    'pkgs/prettier-plugin-maafw-sort'
  ])
})

viteWatch({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  mode: 'development'
}).then(async server => {
  await server.listen()
  server.printUrls()
})
