import type { Node } from 'jsonc-parser'

import { isString, parseObject } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

export function parseFocus(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj] of parseObject(node)) {
    if (isString(obj)) {
      if (obj.value.startsWith('$')) {
        info.refs.push({
          file: ctx.file,
          location: obj,
          type: 'task.locale',
          target: obj.value.substring(1)
        })
      } else {
        if (obj.value.length > 0) {
          info.refs.push({
            file: ctx.file,
            location: obj,
            type: 'task.can_locale',
            target: obj.value
          })
        }
      }
    }
  }
}
