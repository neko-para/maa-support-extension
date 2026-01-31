import type { Node } from 'jsonc-parser'

import type { RelativePath } from '../../utils/types'
import { isString } from '../utils'
import type { InterfaceInfo, InterfaceParseContext } from './interface'

export function parseImport(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  if (isString(node)) {
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'interface.import_path',
      target: node.value as RelativePath
    })
  }
}
