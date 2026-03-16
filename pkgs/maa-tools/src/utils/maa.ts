import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'

import { MaaVersionManager } from '@nekosu/maa-version-manager'

import pkg from '../../package.json'
import type { FullConfig } from '../types/config'

export async function setupMaa(cfg: FullConfig) {
  const versionManager = new MaaVersionManager(
    cfg.maaCache ?? path.join(os.homedir(), '.maa-tools')
  )
  versionManager.registry = MaaVersionManager.registries[cfg.maaMirror ?? 'npm']

  let maaVersion = cfg.maaVersion
  if (maaVersion === 'latest') {
    const latest = (await versionManager.fetchLatest())?.version
    if (latest) {
      maaVersion = latest
      if (cfg.mode !== 'json') {
        process.stdout.write(`use latest version ${latest}\n`)
      }
    }
  }
  if (!maaVersion) {
    const fallback = pkg.devDependencies['@maaxyz/maa-node']
    maaVersion = fallback
    if (cfg.mode !== 'json') {
      process.stdout.write(`use fallback version ${fallback}\n`)
    }
  }

  await versionManager.init()
  if (
    !(await versionManager.prepare(maaVersion, msg => {
      if (cfg.mode !== 'json') {
        if (msg === 'prepare-folder') {
          console.log('preparing maafw')
        }
        console.log('    ' + msg)
      }
    }))
  ) {
    return null
  }
  return versionManager.moduleFolder(maaVersion)
}

export async function loadMaa(modulePath: string, logDir: string) {
  const importTarget = path.join(modulePath, '@maaxyz/maa-node/dist/index-client.js')
  await import(url.pathToFileURL(importTarget).toString())
  maa.Global.log_dir = logDir
}
