import type { Node } from 'jsonc-parser'

import { isString, parseObject } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseGroup(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          info.decls.push({
            file: ctx.file,
            location: obj,
            type: 'interface.group',
            name: obj.value
          })
        }
        break
    }
  }
}
