import { cp, rm } from 'node:fs/promises'
import path from 'node:path'
import { build as viteBuild } from 'vite'

import { buildChain } from './utils.mjs'

await buildChain([
  'pkgs/simple-parser',
  'pkgs/maa-tasker',

  'pkgs/maa-version-manager',
  'pkgs/maa-pipeline-manager',
  'pkgs/maa-locale',
  'pkgs/types',
  'pkgs/maa-server-proto',

  'pkgs/maa-server',
  'pkgs/maa-tools',
  'pkgs/extension',

  'pkgs/prettier-plugin-maafw-sort'
])

const serverDist = path.join(import.meta.dirname, '../pkgs/maa-server/dist')
const releaseServer = path.join(import.meta.dirname, '../release/server')
await rm(releaseServer, { recursive: true, force: true })
await cp(serverDist, releaseServer, { recursive: true })

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})
