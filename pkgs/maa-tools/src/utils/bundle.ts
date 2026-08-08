import { existsSync } from 'node:fs'
import * as path from 'node:path'

import {
  FsContentLoader,
  FsContentWatcher,
  type IContentLoader,
  type IContentWatcher,
  InterfaceBundle
} from '@nekosu/maa-pipeline-manager'

import type { BaseConfig } from '../types/config'

export class CachedContentLoader implements IContentLoader {
  private readonly loader: IContentLoader
  private readonly contents = new Map<string, Promise<string | null>>()

  constructor(loader: IContentLoader = new FsContentLoader()) {
    this.loader = loader
  }

  get(file: string) {
    let content = this.contents.get(file)
    if (!content) {
      content = this.loader.get(file)
      this.contents.set(file, content)
    }
    return content
  }
}

export async function loadBundle(
  cfg: BaseConfig,
  loader: IContentLoader = new FsContentLoader(),
  watcher: IContentWatcher = new FsContentWatcher()
) {
  const interfacePath = path.resolve(cfg.cwd ?? process.cwd(), cfg.interfacePath)

  if (!existsSync(interfacePath)) {
    console.log(`${interfacePath} not exists`)
    return null
  }

  const bundle = new InterfaceBundle(
    loader,
    watcher,
    false,
    path.dirname(interfacePath),
    path.basename(interfacePath),
    cfg.parser
  )
  await bundle.load()
  await bundle.flush(false) // 刷下 imports

  return bundle
}
