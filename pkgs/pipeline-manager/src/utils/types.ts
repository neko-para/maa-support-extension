import * as path from 'path'

export type RelativePath = string & { __brand: 'RelativePath' }
export type AbsolutePath = string & { __brand: 'AbsolutePath' }

export type TaskName = string & { __brand: 'TaskName' }
export type AnchorName = string & { __brand: 'AnchorName' }
// 移除了 image/ 开头的相对路径
export type ImageRelativePath = string & { __brand: 'ImagePath' }

export function joinPath(
  absolute: AbsolutePath,
  ...relatives: (RelativePath | string)[]
): AbsolutePath
export function joinPath(...relatives: (RelativePath | string)[]): RelativePath
export function joinPath(...segs: string[]): string {
  return path.join(...segs)
}

export function joinImagePath(root: AbsolutePath, image: ImageRelativePath): AbsolutePath {
  return path.join(root, 'image', image) as AbsolutePath
}

export function relativePath(base: AbsolutePath, target: AbsolutePath): RelativePath {
  return path.relative(base, target) as RelativePath
}
