import type { Node } from 'jsonc-parser'

import { isString, parseObject } from '../utils'
import type { InterfaceInfo } from './interface'

export function parseLanguage(node: Node, info: InterfaceInfo) {
  for (const [key, obj] of parseObject(node)) {
    if (isString(obj)) {
      info.decls.push({
        location: obj,
        type: 'interface.language',
        name: key,
        path: obj.value
      })
      info.refs.push({
        location: obj,
        type: 'interface.language_path',
        target: obj.value
      })
    }
  }
}
