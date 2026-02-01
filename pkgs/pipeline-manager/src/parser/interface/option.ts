import type { Node } from 'jsonc-parser'

import type { AbsolutePath } from '../../utils/types'
import { isString, parseArray, parseObject } from '../utils'
import { parseCases } from './case'
import { parseInputs } from './input'
import type { IntOptionType, InterfaceInfo, InterfaceParseContext } from './interface'
import { parseOverride } from './override'

function parseInputRef(
  node: Node,
  info: InterfaceInfo,
  option: string,
  names: [name: string, re: RegExp][],
  ctx: InterfaceParseContext
) {
  if (isString(node)) {
    for (const [name, re] of names) {
      for (const occur of node.value.matchAll(re)) {
        info.refs.push({
          file: ctx.file,
          location: node,
          type: 'interface.input',
          target: name,
          option,
          offset: occur.index
        })
      }
    }
  } else {
    if (node.type === 'array') {
      for (const obj of parseArray(node)) {
        parseInputRef(obj, info, option, names, ctx)
      }
    } else if (node.type === 'object') {
      for (const [, obj] of parseObject(node)) {
        parseInputRef(obj, info, option, names, ctx)
      }
    }
  }
}

function parseOptionSec(
  node: Node,
  info: InterfaceInfo,
  option: string,
  ctx: InterfaceParseContext
): IntOptionType | undefined {
  let type: IntOptionType | undefined = undefined
  let inputNames: string[] = []
  let overrideNode: Node | null = null
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'type':
        if (isString(obj)) {
          if (['select', 'switch', 'input'].includes(obj.value)) {
            type = obj.value as IntOptionType
          }
        }
        break
      case 'cases':
        parseCases(obj, info, option, ctx)
        break
      case 'inputs':
        inputNames = parseInputs(obj, info, option, ctx)
        break
      case 'pipeline_override':
        overrideNode = obj
        break
      case 'default_case':
        if (isString(obj)) {
          info.refs.push({
            file: ctx.file,
            location: obj,
            type: 'interface.case',
            target: obj.value,
            option
          })
        }
        break
    }
  }
  if (overrideNode) {
    const names: [name: string, re: RegExp][] = []
    for (const name of inputNames) {
      names.push([name, new RegExp('\\{' + name + '\\}', 'g')])
    }
    parseInputRef(overrideNode, info, option, names, ctx)
    parseOverride(overrideNode, info, ctx)
  }
  return type
}

export function parseOption(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj, prop] of parseObject(node)) {
    const type = parseOptionSec(obj, info, key, ctx)
    info.decls.push({
      file: ctx.file,
      location: prop,
      type: 'interface.option',
      name: key,
      optionType: type
    })
  }
}
