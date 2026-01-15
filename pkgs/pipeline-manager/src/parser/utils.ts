import type { Node } from 'jsonc-parser'

export type PropPair = [prop: string, value: Node, propNode: Node]

function parseProp(prop: Node): PropPair | null {
  if (prop.type !== 'property' || !prop.children || prop.children.length !== 2) {
    return null
  }
  const [key, obj] = prop.children
  if (key.type !== 'string' || typeof key.value !== 'string') {
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

export function isString(
  node: Node
): node is Omit<Node, 'type' | 'value'> & { type: 'string'; value: string } {
  return node.type === 'string' && typeof node.value === 'string'
}

export function isBool(
  node: Node
): node is Omit<Node, 'type' | 'value'> & { type: 'boolean'; value: boolean } {
  return node.type === 'boolean' && typeof node.value === 'boolean'
}
