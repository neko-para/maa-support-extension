import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'

import { MaaVersionManager } from '@nekosu/maa-version-manager'

import pkg from '../../package.json'
import type { FullConfig } from '../types/config'

export async function setupMaa(cfg: FullConfig) {
  const maaVersion = cfg.maaVersion ?? pkg.devDependencies['@maaxyz/maa-node']

  const versionManager = new MaaVersionManager(
    cfg.maaCache ?? path.join(os.homedir(), '.maa-checker')
  )
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

export async function loadMaa(modulePath: string) {
  const importTarget = path.join(modulePath, '@maaxyz/maa-node/dist/index-client.js')
  await import(url.pathToFileURL(importTarget).toString())
}
