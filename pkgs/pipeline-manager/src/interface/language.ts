import { EventEmitter } from 'node:events'

import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import { type StringNode, isString, parseObject } from '../parser/utils'
import { type AbsolutePath, type RelativePath, joinPath } from '../utils/types'

export type LanguageLocaleEntry = {
  key: string
  keyNode: StringNode
  value: string
  valueNode: StringNode
}

export type LanguageInfo = {
  name: string
  file: RelativePath
  content: ContentJson<Record<string, string>>
  entries: LanguageLocaleEntry[]
}

export class LanguageBundle extends EventEmitter<{
  localeChanged: []
}> {
  loader: IContentLoader
  watcher: IContentWatcher
  root: AbsolutePath

  langs: LanguageInfo[]

  constructor(loader: IContentLoader, watcher: IContentWatcher, root: AbsolutePath) {
    super()

    this.loader = loader
    this.watcher = watcher
    this.root = root

    this.langs = []
  }

  stop() {
    for (const lang of this.langs) {
      lang.content.stop()
    }
  }

  async flush() {
    await Promise.all(this.langs.map(lang => lang.content.flush()))
  }

  async update(config: [name: string, file: RelativePath][]) {
    const currentConfig = JSON.stringify(this.langs.map(info => [info.name, info.file]))
    if (currentConfig === JSON.stringify(config)) {
      return true
    }
    this.stop()
    this.langs = config.map(([name, file], idx) => ({
      name,
      file,
      content: new ContentJson(this.loader, this.watcher, joinPath(this.root, file), async () => {
        await this.rebuildIndex(idx)
      }),
      entries: []
    }))
    await Promise.all(this.langs.map(lang => lang.content.load()))
  }

  async rebuildIndex(idx: number) {
    const lang = this.langs[idx]
    lang.entries = []
    for (const [key, obj, prop] of parseObject(lang.content.node)) {
      if (isString(obj)) {
        lang.entries.push({
          key,
          keyNode: prop,
          value: obj.value,
          valueNode: obj
        })
      }
    }
  }

  allKeys() {
    const keys = this.langs.map(lang => lang.entries.map(entry => entry.key)).flat()
    return [...new Set(keys)]
  }

  queryName(name?: string) {
    const idx = this.langs.findIndex(lang => lang.name === name)
    return idx === -1 ? 0 : idx
  }

  queryKey(key: string) {
    const result: (LanguageLocaleEntry | null)[] = []

    for (const lang of this.langs) {
      const info = lang.entries.find(info => info.key === key)
      result.push(info ?? null)
    }

    return result
  }
}
