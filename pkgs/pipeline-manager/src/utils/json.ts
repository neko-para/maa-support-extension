import { type Node, parseTree } from 'jsonc-parser'

import { parseArray, parseObject } from '../parser/utils'

function shrinkParent(node: Node) {
  type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> }
  delete (node as DeepWriteable<Node>).parent
  for (const child of node.children ?? []) {
    shrinkParent(child)
  }
}

export function parseTreeWithoutParent(content: string): Node | undefined {
  const node = parseTree(content)
  if (node) {
    shrinkParent(node)
  }
  return node
}

export function buildTree(node: Node): any {
  switch (node.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return node.value ?? null
    case 'object':
      return Object.fromEntries([...parseObject(node)].map(([key, obj]) => [key, buildTree(obj)]))
    case 'array':
      return [...parseArray(node)].map(buildTree)
    case 'property':
      return null
    case 'null':
      return null
  }
  return null
}
