import type { Node } from 'jsonc-parser'

import { buildTree, parseTreeWithoutParent } from '../utils/json'
import type { AbsolutePath } from '../utils/types'
import type { IContentLoader } from './loader'

export class StaticContentJson<T = unknown> {
  loader: IContentLoader
  file: AbsolutePath
  node?: Node
  object?: T

  constructor(loader: IContentLoader, file: AbsolutePath) {
    this.loader = loader
    this.file = file
  }

  async load() {
    const content = await this.loader.get(this.file)
    if (typeof content === 'string') {
      this.node = parseTreeWithoutParent(content)
      this.object = this.node ? (buildTree(this.node) as T) : undefined
    } else {
      this.node = undefined
      this.object = undefined
    }
  }
}

export async function loadAndParse(
  loader: IContentLoader,
  file: AbsolutePath
): Promise<{ node?: Node; object: unknown }> {
  const content = await loader.get(file)
  if (typeof content !== 'string') {
    return { node: undefined, object: undefined }
  }
  const node = parseTreeWithoutParent(content)
  return { node, object: node ? buildTree(node) : undefined }
}
