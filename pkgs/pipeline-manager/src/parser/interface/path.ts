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
    return target
  } else {
    return ''
  }
}

export function parsePath(node: Node, info: InterfaceInfo) {
  const result: string[] = []
  if (node.type !== 'array') {
    result.push(parseSingle(node, info))
  } else {
    for (const obj of parseArray(node)) {
      result.push(parseSingle(obj, info))
    }
  }
  return result.filter(res => res !== '')
}
