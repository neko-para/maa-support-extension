import { parseInterface } from '../parser/interface/interface'
import type { InterfaceDeclInfo, InterfaceRefInfo } from '../parser/interface/interface'
import { parseTreeWithoutParent } from '../utils/json'
import type { AbsolutePath } from '../utils/types'
import type { IContentLoader } from './loader'

export async function loadInterface(
  loader: IContentLoader,
  file: AbsolutePath,
  maa: boolean,
  importMode = false
): Promise<{ decls: InterfaceDeclInfo[]; refs: InterfaceRefInfo[] }> {
  const content = await loader.get(file)
  const decls: InterfaceDeclInfo[] = []
  const refs: InterfaceRefInfo[] = []
  if (!content) {
    return { decls, refs }
  }
  const node = parseTreeWithoutParent(content)
  if (!node) {
    return { decls, refs }
  }
  const info = { decls, refs, layer: undefined as never }
  parseInterface(node, info, { maa, file, import: importMode })
  return { decls: info.decls, refs: info.refs }
}
