import * as path from 'node:path'

import { FsContentLoader, FsContentWatcher, InterfaceBundle } from '@nekosu/maa-pipeline-manager'

export async function loadBundle(interfacePath: string) {
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
