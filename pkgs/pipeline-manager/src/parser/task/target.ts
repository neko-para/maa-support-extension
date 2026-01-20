import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { isString, parseArray } from '../utils'
import type { TaskInfo } from './task'

export function parseTarget(node: Node, info: TaskInfo, acceptArray = false) {
  if (isString(node)) {
    info.refs.push({
      location: node,
      type: 'task.target',
      target: node.value as TaskName
    })
  } else if (acceptArray) {
    for (const obj of parseArray(node)) {
      parseTarget(obj, info)
    }
  }
}
