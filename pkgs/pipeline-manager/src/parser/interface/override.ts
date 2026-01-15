import type { Node } from 'jsonc-parser'

import { parseTask } from '../task/task'
import { parseObject } from '../utils'
import type { InterfaceInfo } from './interface'

export function parseOverride(node: Node, info: InterfaceInfo) {
  for (const [key, obj, prop] of parseObject(node)) {
    info.tasks.push({
      name: key,
      prop,
      info: parseTask(obj)
    })
  }
}
