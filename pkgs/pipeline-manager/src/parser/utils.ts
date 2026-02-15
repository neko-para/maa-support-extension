import type { Node } from 'jsonc-parser'

export type PropPair = [prop: string, value: Node, propNode: StringNode]

function parseProp(prop: Node): PropPair | null {
  // TODO: 这里如果是刚新开一个prop, 会是一个string. 之后看能不能把这个信息暴露上去
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
