import type { InterfaceParseResult, ParsedInterface } from './types'

/**
 * 将 import 文件的内容合并到主 interface 中。
 *
 * 按照 ProjectInterface V2 协议，import 文件仅贡献 task / option / preset。
 * 其他字段（controller、resource、import 等）仅主 interface 文件有效。
 *
 * 纯函数 — 不修改输入对象。
 */
export function mergeInterfaces(
  base: InterfaceParseResult,
  ...imports: InterfaceParseResult[]
): InterfaceParseResult {
  if (imports.length === 0) {
    return base
  }

  const mergedData: ParsedInterface = { ...base.data }
  mergedData.task = { ...base.data.task }
  mergedData.option = { ...base.data.option }
  mergedData.preset = { ...base.data.preset }

  const mergedDecls = [...base.decls]
  const mergedRefs = [...base.refs]

  for (const imp of imports) {
    if (imp.data.task) {
      Object.assign(mergedData.task, imp.data.task)
    }
    if (imp.data.option) {
      Object.assign(mergedData.option, imp.data.option)
    }
    if (imp.data.preset) {
      Object.assign(mergedData.preset, imp.data.preset)
    }
    mergedDecls.push(...imp.decls)
    mergedRefs.push(...imp.refs)
  }

  return { data: mergedData, decls: mergedDecls, refs: mergedRefs }
}
