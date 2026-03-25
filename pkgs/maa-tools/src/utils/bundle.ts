import { existsSync } from 'node:fs'
import * as path from 'node:path'

import { FsContentLoader, FsContentWatcher, InterfaceBundle } from '@nekosu/maa-pipeline-manager'

import type { BaseConfig } from '../types/config'

export async function loadBundle(cfg: BaseConfig) {
  const interfacePath = path.resolve(cfg.cwd ?? process.cwd(), cfg.interfacePath)

  if (!existsSync(interfacePath)) {
    console.log(`${interfacePath} not exists`)
    return null
  }

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(interfacePath),
    path.basename(interfacePath),
    cfg.parser
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  return bundle
}
