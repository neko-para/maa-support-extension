import type { Node } from 'jsonc-parser'

import { isString, parseArray, parseObject } from '../utils'
import type { IntInputDeclInfo, InterfaceInfo, InterfaceParseContext } from './interface'

function isPipelineType(type: string): type is 'string' | 'int' | 'bool' {
  return ['string', 'int', 'bool'].includes(type)
}

function parseInput(node: Node, info: InterfaceInfo, option: string, ctx: InterfaceParseContext) {
  let loc: Node | null = null
  const decl: IntInputDeclInfo = {
    type: 'interface.input',
    name: '',
    option
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          loc = obj
          decl.name = obj.value
        }
        break
      case 'pipeline_type':
        if (isString(obj) && isPipelineType(obj.value)) {
          decl.cast = obj.value
        }
        break
    }
  }
  if (loc) {
    info.decls.push({
      file: ctx.file,
      location: loc,
      ...decl
    })
    return decl.name
  } else {
    return null
  }
}

export function parseInputs(
  node: Node,
  info: InterfaceInfo,
  option: string,
  ctx: InterfaceParseContext
) {
  const names: string[] = []
  for (const obj of parseArray(node)) {
    const name = parseInput(obj, info, option, ctx)
    if (name) {
      names.push(name)
    }
  }
  return names
}
