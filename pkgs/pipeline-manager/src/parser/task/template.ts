import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { TaskInfo } from './task'

function parseSingle(node: Node, info: TaskInfo) {
  if (isString(node)) {
    info.refs.push({
      location: node,
      type: 'task.template',
      target: node.value
    })
  }
}

export function parseTemplate(node: Node, info: TaskInfo) {
  if (node.type !== 'array') {
    parseSingle(node, info)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info)
    }
  }
}
