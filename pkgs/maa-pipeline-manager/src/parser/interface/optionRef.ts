import type { Node } from 'jsonc-parser'

import type { OptionTrace } from '../../logic'
import { isString, parseArray } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseOptionRef(
  node: Node,
  info: InterfaceInfo,
  ctx: InterfaceParseContext,
  trace: Omit<OptionTrace, 'name'>
) {
  for (const obj of parseArray(node)) {
    if (isString(obj)) {
      info.refs.push({
        file: ctx.file,
        location: obj,
        type: 'interface.option',
        target: obj.value,
        trace: {
          name: obj.value,
          ...trace
        }
      })
    }
  }
}
