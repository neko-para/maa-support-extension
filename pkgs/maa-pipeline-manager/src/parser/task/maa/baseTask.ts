import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../../utils/types'
import { isString } from '../../utils'
import { type TaskInfo, type TaskParseContext, buildTaskRef } from '../task'

export function parseMaaBaseTask(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.maa.base_task',
      target: node.value as TaskName,
      tasks: buildTaskRef(node.value as TaskName),
      belong: ctx.taskName
    })
  }
}
