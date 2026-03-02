import { existsSync } from 'node:fs'
import * as path from 'node:path'

import { FsContentLoader, FsContentWatcher, InterfaceBundle } from '@nekosu/maa-pipeline-manager'

export async function loadBundle(interfacePath: string) {
  if (!existsSync(interfacePath)) {
    console.log(`${interfacePath} not exists`)
    return null
  }

  const bundle = new InterfaceBundle(
    new FsContentLoader(),
    new FsContentWatcher(),
    false,
    path.dirname(interfacePath),
    path.basename(interfacePath)
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  return bundle
}
