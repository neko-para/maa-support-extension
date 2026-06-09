import * as path from 'node:path'

import type { IPathUtils } from './interface'

function join(absolute: string, ...segments: string[]): string
function join(...segments: string[]): string {
  return path.join(...segments)
}

function relative(from: string, to: string): string {
  return path.relative(from, to)
}

function normalize(p: string): string {
  return path.normalize(p)
}

function dirname(p: string): string {
  return path.dirname(p)
}

export const nodePathUtils: IPathUtils = {
  join: join as IPathUtils['join'],
  relative: relative as IPathUtils['relative'],
  normalize: normalize as IPathUtils['normalize'],
  dirname: dirname as IPathUtils['dirname'],
  basename(p: string): string {
    return path.basename(p)
  },
  get sep(): string {
    return path.sep
  }
}
