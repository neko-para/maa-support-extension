import type { Node } from 'jsonc-parser'

import { isString } from '../utils'
import type { TaskInfo } from './task'

export function parseSubName(node: Node, info: TaskInfo, parent: Node) {
  if (isString(node)) {
    info.decls.push({
      location: node,
      type: 'task.sub_reco',
      name: node.value,
      reco: parent
    })
  }
}
