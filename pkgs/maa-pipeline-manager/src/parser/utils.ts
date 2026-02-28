import type { Node } from 'jsonc-parser'

export type PropPair = [prop: string, value: Node, propNode: StringNode]
export type PropPairFlex = [prop: string, value: Node | null, propNode: StringNode]

function parseProp(prop: Node): PropPair | null {
  const pair = parsePropFlex(prop)
  if (!pair) {
    return null
  }
  const [key, obj, node] = pair
  if (!obj) {
    return null
  }
  return [key, obj, node]
}

function parsePropFlex(prop: Node): PropPairFlex | null {
  if (prop.type === 'property' && prop.children?.length === 1 && isString(prop.children[0])) {
    return [prop.children[0].value, null, prop.children[0]]
  }
  if (prop.type !== 'property' || !prop.children || prop.children.length !== 2) {
    return null
  }
  const [key, obj] = prop.children
  if (!isString(key)) {
    return null
  }
  return [key.value, obj, key]
}

export function* parseObject(node: Node | undefined | null) {
  if (!node || node.type !== 'object') {
    return
  }
  for (const prop of node.children ?? []) {
    const pair = parseProp(prop)
    if (pair) {
      yield pair
    }
  }
}

export function* parseObjectFlex(node: Node | undefined | null) {
  if (!node || node.type !== 'object') {
    return
  }
  for (const prop of node.children ?? []) {
    const pair = parsePropFlex(prop)
    if (pair) {
      yield pair
    }
  }
}

export function* parseArray(node: Node | undefined | null) {
  if (!node || node.type !== 'array') {
    return
  }
  for (const obj of node.children ?? []) {
    yield obj
  }
}

export type StringNode = Omit<Node, 'type' | 'value'> & { type: 'string'; value: string }

export function isString(node?: Node): node is StringNode {
  return !!node && node.type === 'string' && typeof node.value === 'string'
}

export type NumberNode = Omit<Node, 'type' | 'value'> & { type: 'number'; value: number }

export function isNumber(node?: Node): node is NumberNode {
  return !!node && node.type === 'number' && typeof node.value === 'number'
}

export type BoolNode = Omit<Node, 'type' | 'value'> & { type: 'boolean'; value: boolean }

export function isBool(node?: Node): node is BoolNode {
  return !!node && node.type === 'boolean' && typeof node.value === 'boolean'
}
