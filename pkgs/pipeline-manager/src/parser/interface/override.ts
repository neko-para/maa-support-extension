import type { Node } from 'jsonc-parser'

import { parseTask } from '../task/task'
import { parseObject } from '../utils'
import type { InterfaceInfo } from './interface'

export function parseOverride(node: Node, info: InterfaceInfo, file: string) {
  for (const [key, obj, prop] of parseObject(node)) {
    if (key.startsWith('$')) {
      continue
    }

    info.layer.mutableTaskInfo(key).push({
      file,
      prop,
      data: obj,
      info: parseTask(obj, key)
    })
  }
}
