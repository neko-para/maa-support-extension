import { type Node, parseTree } from 'jsonc-parser'

import { parseArray, parseObject } from './parse'

function shrinkParent(node: Node): void {
  type DeepWritable<T> = { -readonly [P in keyof T]: DeepWritable<T[P]> }
  delete (node as DeepWritable<Node>).parent
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

export function buildTree(node: Node): unknown {
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
    case 'null':
      return null
  }
  return null
}
