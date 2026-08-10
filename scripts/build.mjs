import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
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
await verifyStandaloneServer(releaseServer)

viteBuild({
  root: path.join(import.meta.dirname, '../pkgs/webview')
})

async function verifyStandaloneServer(serverDir) {
  const isolatedDir = await mkdtemp(path.join(os.tmpdir(), 'mse-server-bundle-'))
  try {
    await cp(serverDir, isolatedDir, { recursive: true })
    const result = spawnSync(process.execPath, [path.join(isolatedDir, 'index.mjs'), 'eA=='], {
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true
    })
    if (result.error) throw result.error

    const output = `${result.stdout}\n${result.stderr}`
    if (result.status === 0 || !output.includes('"x" is not valid JSON')) {
      throw new Error(`Standalone maa-server validation failed:\n${output}`)
    }
  } finally {
    await rm(isolatedDir, { recursive: true, force: true })
  }
}
