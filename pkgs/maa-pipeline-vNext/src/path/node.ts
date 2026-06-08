import * as path from 'node:path'

import type { IPathUtils } from './interface'

export const nodePathUtils: IPathUtils = {
  join(...segments: string[]): string {
    return path.join(...segments)
  },
  relative(from: string, to: string): string {
    return path.relative(from, to)
  },
  normalize(p: string): string {
    return path.normalize(p)
  },
  basename(p: string): string {
    return path.basename(p)
  },
  dirname(p: string): string {
    return path.dirname(p)
  },
  get sep(): string {
    return path.sep
  }
}
