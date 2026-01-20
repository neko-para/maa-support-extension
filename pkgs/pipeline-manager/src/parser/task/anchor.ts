import type { Node } from 'jsonc-parser'

import type { AnchorName, TaskName } from '../../utils/types'
import { isString, parseArray } from '../utils'
import type { TaskDeclInfo, TaskInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    info.decls.push({
      file: ctx.file,
      location: node,
      type: 'task.anchor',
      anchor: node.value as AnchorName,
      task: ctx.task.value as TaskName
    })
  }
}
export function parseAnchor(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (node.type !== 'array') {
    parseSingle(node, info, ctx)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info, ctx)
    }
  }
}
