import type { Node } from 'jsonc-parser'

import type { AbsolutePath, TaskName } from '../../utils/types'
import { parseTask } from '../task/task'
import { parseObject } from '../utils'
import type { InterfaceInfo } from './interface'

export function parseOverride(node: Node, info: InterfaceInfo, file: AbsolutePath) {
  for (const [key, obj, prop] of parseObject(node)) {
    if (key.startsWith('$')) {
      continue
    }

    info.layer.mutableTaskInfo(key as TaskName).push({
      file,
      prop,
      data: obj,
      info: parseTask(obj, {
        file,
        task: prop
      })
    })
    info.layer.markDirty()
  }
}
