import type { Node } from 'jsonc-parser'

import { isString, parseArray, parseObject } from '../utils'
import type { InterfaceInfo } from './interface'
import { parseOptionRef } from './optionRef'
import { parseOverride } from './override'

function parseCase(node: Node, info: InterfaceInfo, option: string, file: string) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          info.decls.push({
            location: obj,
            type: 'interface.case',
            name: obj.value,
            option
          })
        }
        break
      case 'option':
        parseOptionRef(obj, info)
        break
      case 'pipeline_override':
        parseOverride(obj, info, file)
        break
    }
  }
}

export function parseCases(node: Node, info: InterfaceInfo, option: string, file: string) {
  for (const obj of parseArray(node)) {
    parseCase(obj, info, option, file)
  }
}
