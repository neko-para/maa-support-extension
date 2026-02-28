import type { Node } from 'jsonc-parser'

import { isString, parseObject } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseLanguage(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj] of parseObject(node)) {
    if (isString(obj)) {
      info.decls.push({
        file: ctx.file,
        location: obj,
        type: 'interface.language',
        name: key,
        path: obj.value
      })
      info.refs.push({
        file: ctx.file,
        location: obj,
        type: 'interface.language_path',
        target: obj.value
      })
    }
  }
}
