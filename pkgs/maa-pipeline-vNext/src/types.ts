/**
 * 品牌化类型（Branded Types）
 *
 * 轻量级名义类型，防止 TaskName / AbsolutePath / RelativePath 等
 * 在函数参数中混淆。零运行时开销，纯编译期检查。
 */

export type TaskName = string & { __brand: 'TaskName' }
export type AnchorName = string & { __brand: 'AnchorName' }

export type RelativePath = string & { __brand: 'RelativePath' }
export type AbsolutePath = string & { __brand: 'AbsolutePath' }
export type ImageRelativePath = string & { __brand: 'ImagePath' }
