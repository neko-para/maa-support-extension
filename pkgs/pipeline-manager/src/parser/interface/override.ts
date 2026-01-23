import type { Node } from 'jsonc-parser'

import { buildTree } from '../../utils/json'
import type { TaskName } from '../../utils/types'
import { parseTask } from '../task/task'
import { parseObject } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseOverride(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj, prop] of parseObject(node)) {
    if (key.startsWith('$')) {
      continue
    }

    info.layer.mutableTaskInfo(key as TaskName).push({
      file: ctx.file,
      prop,
      data: obj,
      info: parseTask(obj, {
        maa: ctx.maa,
        file: ctx.file,
        task: prop,
        taskName: key as TaskName
      }),
      obj: buildTree(obj)
    })
    info.layer.markDirty()
  }
}
