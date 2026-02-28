import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseCtrlRef(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  const refs: string[] = []
  for (const obj of parseArray(node)) {
    if (isString(obj)) {
      info.refs.push({
        file: ctx.file,
        location: obj,
        type: 'interface.controller',
        target: obj.value
      })
      refs.push(obj.value)
    }
  }
  return refs
}
