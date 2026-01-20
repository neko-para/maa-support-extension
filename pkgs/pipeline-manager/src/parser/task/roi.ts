import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { type StringNode, isString } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

export function parseRoi(node: Node, info: TaskInfo, prev: StringNode[], ctx: TaskParseContext) {
  if (isString(node)) {
    const prevRef = !!prev.find(decl => decl.value === node.value)
    if (prevRef) {
      info.refs.push({
        file: ctx.file,
        location: node,
        type: 'task.roi',
        target: node.value,
        prev: [...prev],
        task: ctx.task.value as TaskName,
        prevRef: true
      })
    } else {
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
}
