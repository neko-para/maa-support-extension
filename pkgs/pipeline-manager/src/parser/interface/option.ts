import type { Node } from 'jsonc-parser'

import { isString, parseArray, parseObject } from '../utils'
import { parseCases } from './case'
import { parseInputs } from './input'
import type { InterfaceInfo } from './interface'
import { parseOverride } from './override'

function parseInputRef(
  node: Node,
  info: InterfaceInfo,
  option: string,
  names: [name: string, re: RegExp][]
) {
  if (isString(node)) {
    for (const [name, re] of names) {
      for (const occur of node.value.matchAll(re)) {
        info.refs.push({
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
        parseInputRef(obj, info, option, names)
      }
    } else if (node.type === 'object') {
      for (const [, obj] of parseObject(node)) {
        parseInputRef(obj, info, option, names)
      }
    }
  }
}

function parseOptionSec(node: Node, info: InterfaceInfo, option: string, file: string) {
  let inputNames: string[] = []
  let overrideNode: Node | null = null
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'cases':
        parseCases(obj, info, option, file)
        break
      case 'inputs':
        inputNames = parseInputs(obj, info, option)
        break
      case 'pipeline_override':
        overrideNode = obj
        break
      case 'default_case':
        if (isString(obj)) {
          info.refs.push({
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
    parseInputRef(overrideNode, info, option, names)
    parseOverride(overrideNode, info, file)
  }
}

export function parseOption(node: Node, info: InterfaceInfo, file: string) {
  for (const [key, obj, prop] of parseObject(node)) {
    info.decls.push({
      location: prop,
      type: 'interface.option',
      name: key
    })

    parseOptionSec(obj, info, key, file)
  }
}
