import type { Node } from 'jsonc-parser'

import type { RelativePath } from '../../utils/types'
import { isString, parseArray } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

function parseSingle(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext): RelativePath {
  if (isString(node)) {
    let target = node.value
    if (target.startsWith('{PROJECT_DIR}')) {
      target = target.substring('{PROJECT_DIR}'.length + 1)
    }
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'interface.resource_path',
      target: target as RelativePath
    })
    return target as RelativePath
  } else {
    return '' as RelativePath
  }
}

export function parsePath(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  const result: RelativePath[] = []
  if (node.type !== 'array') {
    result.push(parseSingle(node, info, ctx))
  } else {
    for (const obj of parseArray(node)) {
      result.push(parseSingle(obj, info, ctx))
    }
  }
  return result.filter(res => res !== '')
}
