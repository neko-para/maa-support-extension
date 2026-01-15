import type { Node } from 'jsonc-parser'

import { isString } from '../utils'
import type { TaskInfo } from './task'

export function parseRoi(node: Node, info: TaskInfo) {
  if (isString(node)) {
    info.refs.push({
      location: node,
      type: 'task.roi',
      target: node.value
    })
  }
}
