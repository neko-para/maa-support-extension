import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { type StringNode, isString } from '../utils'
import { parseAttr } from './attr'
import type { TaskInfo, TaskParseContext } from './task'

export function parseRoi(node: Node, info: TaskInfo, prev: StringNode[], ctx: TaskParseContext) {
  if (isString(node)) {
    const [target, attrs] = parseAttr(node.value, ['Anchor'])
    if (attrs.offset > 0) {
      info.refs.push({
        file: ctx.file,
        location: node,
        type: 'task.roi',
        target: target as TaskName,
        attrs,
        prev: [...prev],
        task: ctx.taskName,
        prevRef: false
      })
    } else {
      const prevRef = !!prev.find(decl => decl.value === node.value)
      info.refs.push({
        file: ctx.file,
        location: node,
        type: 'task.roi',
        target: node.value as TaskName,
        attrs: { offset: 0, attrs: {}, unknown: [] },
        prev: [...prev],
        task: ctx.taskName,
        prevRef
      })
    }
  }
}
