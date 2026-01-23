import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { isString } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

export function parseSubName(node: Node, info: TaskInfo, parent: Node, ctx: TaskParseContext) {
  if (isString(node)) {
    info.decls.push({
      file: ctx.file,
      location: node,
      type: 'task.sub_reco',
      name: node.value,
      reco: parent,
      task: ctx.taskName
    })
    return node
  } else {
    return null
  }
}
