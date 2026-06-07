import type { TaskDeclInfo, TaskRefInfo } from '../parser/task/task'
import { type StringNode, isString, parseObject } from '../parser/utils'
import { parseTreeWithoutParent } from '../utils/json'
import type { AbsolutePath } from '../utils/types'
import type { IContentLoader } from './loader'

export type LanguageFileEntry = {
  key: string
  value: string
  keyNode: StringNode
  valueNode: StringNode
}

export type LanguageFileData = {
  entries: LanguageFileEntry[]
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

export async function loadLanguageFile(
  loader: IContentLoader,
  file: AbsolutePath
): Promise<LanguageFileData> {
  const entries: LanguageFileEntry[] = []
  const decls: TaskDeclInfo[] = []
  const refs: TaskRefInfo[] = []

  const content = await loader.get(file)
  if (!content) {
    return { entries, decls, refs }
  }
  const node = parseTreeWithoutParent(content)
  if (!node) {
    return { entries, decls, refs }
  }

  for (const [key, obj, prop] of parseObject(node)) {
    if (isString(obj)) {
      entries.push({ key, value: obj.value, keyNode: prop, valueNode: obj })
      decls.push({
        location: prop,
        file,
        type: 'task.locale',
        key,
        value: obj.value,
        valueNode: obj
      })
      refs.push({
        location: obj,
        file,
        type: 'task.locale_text',
        target: obj.value
      })
    }
  }

  return { entries, decls, refs }
}
