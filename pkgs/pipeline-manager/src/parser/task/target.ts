import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { TaskInfo } from './task'

export function parseTarget(node: Node, info: TaskInfo, acceptArray = false) {
  if (isString(node)) {
    info.refs.push({
      location: node,
      type: 'task.target',
      target: node.value
    })
  } else if (acceptArray) {
    for (const obj of parseArray(node)) {
      parseTarget(obj, info)
    }
  }
}
