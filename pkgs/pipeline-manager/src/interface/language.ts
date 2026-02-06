import { EventEmitter } from 'node:events'

import { ContentJson } from '../content/json'
import type { IContentLoader } from '../content/loader'
import type { IContentWatcher } from '../content/watch'
import type { TaskDeclInfo } from '../parser/task/task'
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
  decls: TaskDeclInfo[]
}

export type LanguageEditAction =
  | {
      type: 'replace'
      file: AbsolutePath
      content: string
    }
  | {
      type: 'insert'
      file: AbsolutePath
      content: string
      offset: number
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
      entries: [],
      decls: []
    }))
    await Promise.all(this.langs.map(lang => lang.content.load()))
  }

  async rebuildIndex(idx: number) {
    const lang = this.langs[idx]
    const full = joinPath(this.root, lang.file)
    lang.entries = []
    lang.decls = []
    for (const [key, obj, prop] of parseObject(lang.content.node)) {
      if (isString(obj)) {
        lang.entries.push({
          key,
          keyNode: prop,
          value: obj.value,
          valueNode: obj
        })
        lang.decls.push({
          location: prop,
          file: full,
          type: 'task.locale',
          key: key,
          value: obj.value,
          valueNode: obj
        })
      }
    }

    this.emit('localeChanged')
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

  addPair(key: string, value: string, indent = '    '): LanguageEditAction[] {
    const keys = this.allKeys()
    if (keys.includes(key)) {
      return []
    }
    const row = JSON.stringify(key) + ': ' + JSON.stringify(value)
    const result: LanguageEditAction[] = []
    if (keys.length === 0) {
      return this.langs.map(lang => {
        return {
          type: 'replace',
          file: joinPath(this.root, lang.file),
          content: `{
${indent}${row},
}
`
        }
      })
    } else {
      let insertIndex = keys.findIndex(val => val.localeCompare(key) > 0)
      if (insertIndex === -1) {
        insertIndex = keys.length
      }

      const upper = keys.slice(0, insertIndex)
      const lower = keys.slice(insertIndex)

      for (const lang of this.langs) {
        let found = false
        for (const upKey of upper.toReversed()) {
          const anchor = lang.entries.find(entry => entry.key === upKey)
          if (!anchor) {
            continue
          }
          result.push({
            type: 'insert',
            file: joinPath(this.root, lang.file),
            content: `,\n${indent}${row}`,
            offset: anchor.valueNode.offset + anchor.valueNode.length
          })
          found = true
          break
        }
        if (found) {
          continue
        }
        for (const loKey of lower) {
          const anchor = lang.entries.find(entry => entry.key === loKey)
          if (!anchor) {
            continue
          }
          result.push({
            type: 'insert',
            file: joinPath(this.root, lang.file),
            content: `${row},\n${indent}`,
            offset: anchor.keyNode.offset
          })
          found = true
          break
        }
        if (found) {
          continue
        }
        result.push({
          type: 'replace',
          file: joinPath(this.root, lang.file),
          content: `{
${indent}${row},
}
`
        })
      }
    }
    return result
  }
}
