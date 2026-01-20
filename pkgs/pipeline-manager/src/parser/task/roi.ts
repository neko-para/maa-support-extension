import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { type StringNode, isString } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

export function parseRoi(node: Node, info: TaskInfo, prev: StringNode[], ctx: TaskParseContext) {
  if (isString(node)) {
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.roi',
      target: node.value as TaskName,
      prev: [...prev],
      task: ctx.task.value as TaskName
    })
  }
}
