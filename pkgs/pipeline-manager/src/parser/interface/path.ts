import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { InterfaceInfo } from './interface'

function parseSingle(node: Node, info: InterfaceInfo) {
  if (isString(node)) {
    let target = node.value
    if (target.startsWith('{PROJECT_DIR}')) {
      target = target.substring('{PROJECT_DIR}'.length + 1)
    }
    info.refs.push({
      location: node,
      type: 'interface.resource_path',
      target
    })
  }
}

export function parsePath(node: Node, info: InterfaceInfo) {
  if (node.type !== 'array') {
    parseSingle(node, info)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info)
    }
  }
}
