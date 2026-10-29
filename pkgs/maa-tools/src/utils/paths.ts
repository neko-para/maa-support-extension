import * as path from 'node:path'

/** 文件身份比较键；只用于查找和去重，不用于显示或改写返回路径。 */
export function pathKey(file: string, platform: NodeJS.Platform = process.platform): string {
  const resolved = (platform === 'win32' ? path.win32 : path.posix).resolve(file)
  return platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function samePath(left: string, right: string): boolean {
  return pathKey(left) === pathKey(right)
}
