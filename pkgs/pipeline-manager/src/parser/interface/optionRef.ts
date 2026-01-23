import type { Node } from 'jsonc-parser'

import { isString, parseArray } from '../utils'
import type { InterfaceInfo } from './interface'

export function parseOptionRef(node: Node, info: InterfaceInfo) {
  for (const obj of parseArray(node)) {
    if (isString(obj)) {
      info.refs.push({
        location: obj,
        type: 'interface.option',
        target: obj.value
      })
    }
  }
}
