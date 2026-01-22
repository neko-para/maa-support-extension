import type { Node } from 'jsonc-parser'

import { parseObject } from '../utils'
import { parseTarget } from './target'
import type { TaskInfo, TaskParseContext } from './task'

export function parseFreeze(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'target':
        parseTarget(obj, info, ctx)
        break
    }
  }
}
