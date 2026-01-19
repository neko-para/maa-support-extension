import type { Node } from 'jsonc-parser'

import { type StringNode, isString } from '../utils'
import type { TaskInfo } from './task'

export function parseRoi(node: Node, info: TaskInfo, prev: StringNode[]) {
  if (isString(node)) {
    info.refs.push({
      location: node,
      type: 'task.roi',
      target: node.value,
      prev: [...prev]
    })
  }
}
