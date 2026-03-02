import path from 'node:path'
import { build as viteBuild } from 'vite'

import { buildChain } from './utils.mjs'

await buildChain([
  'pkgs/simple-parser',
  'pkgs/maa-tasker',

  'pkgs/maa-version-manager',
  'pkgs/maa-pipeline-manager',
  'pkgs/maa-locale',

  'pkgs/extension',
  'pkgs/maa-tools',
  'pkgs/prettier-plugin-maafw-sort',
  'pkgs/maa-server'
])

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})
