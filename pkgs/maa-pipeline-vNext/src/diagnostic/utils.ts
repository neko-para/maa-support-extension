import type { TaskAttrInfo } from '../pipeline/attr'
import type { TaskRefInfo } from '../pipeline/types'
import type { TaskName } from '../types'
import type { AnchorName, ImageRelativePath } from '../types'

/** 构建诊断位置对象 */
export function diagPos(
  loc: { offset: number; length: number },
  file: string
): { offset: number; length: number; file: string } {
  return { file, offset: loc.offset, length: loc.length }
}

/**
 * 从包含属性前缀的任务引用中，计算去除 `[...]` 后实际任务名的位置。
 *
 * MaaFramework 的 next/target 引用格式为 `[Attr]TaskName`。
 * jsonc-parser 给出的 location 包含整个 JSON 字符串（含双引号）。
 *
 * - `loc` 是 JSON 字符串字面量的位置（含双引号 `"`）
 * - `attrs.offset` 是属性括号的累积长度（由 parseAttr 计算）
 * - 返回值 `offset` 指向属性括号之后的任务名第一个字符
 * - 返回值 `length` 是任务名的字符长度（不含双引号）
 *
 * 示例：`"loc": "[Anchor]TaskName"`（引号内长度=16, attrs.offset=8）
 *   → offset = loc.offset + 8 + 1（跳过 `"` 和 `[Anchor]`）
 *   → length = loc.length - 8 - 2（排除 `"` 对和 `[Anchor]`）
 */
export function adjustForAttrPrefix(
  loc: { offset: number; length: number },
  attrs: TaskAttrInfo<string>
): { offset: number; length: number } {
  return {
    offset: loc.offset + attrs.offset + 1,
    length: loc.length - attrs.offset - 2
  }
}

export function taskRefTarget(r: TaskRefInfo): TaskName | null {
  if (
    r.type === 'task.anchor' ||
    r.type === 'task.reco' ||
    r.type === 'task.color_filter' ||
    r.type === 'task.custom_task' ||
    r.type === 'task.entry'
  ) {
    return r.target
  }
  if (r.type === 'task.next' || r.type === 'task.roi' || r.type === 'task.target') {
    if (r.attrs.attrs.Anchor) {
      return null
    }
    if (r.type === 'task.roi' && r.prevRef) {
      return null
    }
    return r.target
  }
  return null
}

export function imageRefTarget(r: TaskRefInfo): ImageRelativePath | null {
  if (r.type === 'task.template' || r.type === 'task.custom_template') {
    return r.target
  }
  return null
}

export function anchorRefTarget(r: TaskRefInfo): AnchorName | null {
  if (
    (r.type === 'task.next' ||
      r.type === 'task.roi' ||
      r.type === 'task.target' ||
      r.type === 'task.custom_anchor') &&
    r.attrs.attrs.Anchor
  ) {
    return r.target as AnchorName
  }
  return null
}
