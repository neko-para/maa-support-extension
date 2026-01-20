import type { Node } from 'jsonc-parser'

import type { AnchorName, TaskName } from '../../utils/types'
import { isString, parseArray } from '../utils'
import type { TaskDeclInfo, TaskInfo } from './task'

function parseSingle(node: Node, info: TaskInfo, task: TaskName) {
  if (isString(node)) {
    info.decls.push({
      location: node,
      type: 'task.anchor',
      anchor: node.value as AnchorName,
      task
    })
  }
}
export function parseAnchor(node: Node, info: TaskInfo, task: TaskName) {
  if (node.type !== 'array') {
    parseSingle(node, info, task)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info, task)
    }
  }
}
