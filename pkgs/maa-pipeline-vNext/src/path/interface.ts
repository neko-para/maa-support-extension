/**
 * 路径工具抽象接口。
 *
 * 核心模块通过此接口使用路径操作，消除对 node:path 的直接依赖。
 * Node.js 环境注入 NodePathUtils；browser 环境可注入基于 `/` 分隔符的纯字符串实现。
 */
export interface IPathUtils {
  join(...segments: string[]): string
  relative(from: string, to: string): string
  normalize(p: string): string
  basename(p: string): string
  dirname(p: string): string
  readonly sep: string
}
