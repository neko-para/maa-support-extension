import path from 'node:path'
import { build as viteBuild } from 'vite'

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

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview'),
  build: {
    minify: false,
    watch: {}
  }
})
