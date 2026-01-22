import type { Node } from 'jsonc-parser'

import type { ImageRelativePath } from '../../utils/types'
import { isString, parseArray } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.template',
      target: node.value as ImageRelativePath
    })
  }
}

export function parseTemplate(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (node.type !== 'array') {
    parseSingle(node, info, ctx)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info, ctx)
    }
  }
}
