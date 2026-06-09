/**
 * 纯字符串路径工具——无平台依赖，可在任何 JS 运行时使用。
 */

/** 提取路径的文件扩展名（含 `.`，小写）。无扩展名时返回空字符串。 */
export function extname(p: string): string {
  const lastSep = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  const base = lastSep >= 0 ? p.slice(lastSep + 1) : p
  const dot = base.lastIndexOf('.')
  return dot >= 0 ? base.slice(dot).toLowerCase() : ''
}
