import type { AbsolutePath, RelativePath } from '../types'

/**
 * 路径工具抽象接口。
 *
 * 核心模块通过此接口使用路径操作，消除对 node:path 的直接依赖。
 * Node.js 环境注入 NodePathUtils；browser 环境可注入基于 `/` 分隔符的纯字符串实现。
 *
 * 所有方法使用函数重载保证品牌化类型安全：
 * - 输入为 AbsolutePath / RelativePath → 输出保留对应品牌
 * - 输入为普通 string → 输出为普通 string（fallback）
 */
export interface IPathUtils {
  /** 首参数为 AbsolutePath → 返回 AbsolutePath */
  join(absolute: AbsolutePath, ...segments: string[]): AbsolutePath
  join(...segments: string[]): string

  /** 两个 AbsolutePath → 返回 RelativePath */
  relative(from: AbsolutePath, to: AbsolutePath): RelativePath
  relative(from: string, to: string): string

  /** 输入为 AbsolutePath → 输出仍为 AbsolutePath */
  normalize(p: AbsolutePath): AbsolutePath
  normalize(p: RelativePath): RelativePath
  normalize(p: string): string

  /** dirname 保留路径的绝对/相对性质 */
  dirname(p: AbsolutePath): AbsolutePath
  dirname(p: RelativePath): RelativePath
  dirname(p: string): string

  /** basename 始终返回纯文件名（无目录成分），无品牌 */
  basename(p: string): string

  readonly sep: string
}
