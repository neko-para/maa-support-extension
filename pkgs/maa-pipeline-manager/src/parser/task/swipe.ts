import type { Node } from 'jsonc-parser'

import { parseArray, parseObject } from '../utils'
import { parseTarget } from './target'
import type { TaskInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'begin':
        parseTarget(obj, info, ctx)
        break
      case 'end':
        parseTarget(obj, info, ctx, true)
        break
    }
  }
}

export function parseSwipe(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const obj of parseArray(node)) {
    parseSingle(obj, info, ctx)
  }
}
