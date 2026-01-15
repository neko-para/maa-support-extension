import type { Node } from 'jsonc-parser'

import { parseObject } from '../utils'
import { parseTarget } from './target'
import type { TaskInfo } from './task'

export function parseFreeze(node: Node, info: TaskInfo) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'target':
        parseTarget(obj, info)
        break
    }
  }
}
