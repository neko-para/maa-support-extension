import { type Node, parseTree } from 'jsonc-parser'

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
