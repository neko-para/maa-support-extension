import type { Node } from 'jsonc-parser'

import { parseArray, parseObject } from '../utils'
import { parseTarget } from './target'
import type { TaskInfo } from './task'

function parseSingle(node: Node, info: TaskInfo) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'begin':
        parseTarget(obj, info)
        break
      case 'end':
        parseTarget(obj, info, true)
        break
    }
  }
}

export function parseSwipe(node: Node, info: TaskInfo) {
  for (const obj of parseArray(node)) {
    parseSingle(obj, info)
  }
}
