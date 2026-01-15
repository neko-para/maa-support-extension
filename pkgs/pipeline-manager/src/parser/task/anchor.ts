import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { TaskDeclInfo, TaskInfo } from './task'

function parseSingle(node: Node, info: TaskInfo) {
  if (isString(node)) {
    info.decls.push({
      location: node,
      type: 'task.anchor',
      anchor: node.value
    })
  }
}
export function parseAnchor(node: Node, info: TaskInfo) {
  if (node.type !== 'array') {
    parseSingle(node, info)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info)
    }
  }
}
