import type { Node } from 'jsonc-parser'

import type { TaskRefInfo } from '../parser/task/task'
import type { TaskName } from './types'

export function filterDeclRef<T extends { location: Node }>(infos: T[], offset: number) {
  return infos.filter(
    info => info.location.offset <= offset && info.location.offset + info.location.length >= offset
  )
}

export function findDeclRef<T extends { location: Node }>(infos: T[], offset: number) {
  let result: T | null = null
  for (const info of filterDeclRef(infos, offset)) {
    if (result === null) {
      result = info
    } else {
      if (info.location.offset > result.location.offset) {
        result = info
      } else if (info.location.offset < result.location.offset) {
        continue
      } else {
        if (info.location.length < result.location.length) {
          result = info
        }
      }
    }
  }
  return result
}

export function extractTaskRef(r: TaskRefInfo): TaskName | null {
  if (
    r.type === 'task.anchor' ||
    r.type === 'task.reco' ||
    r.type === 'task.color_filter' ||
    r.type === 'task.custom' ||
    r.type === 'task.entry'
  ) {
    return r.target
  } else if (r.type === 'task.next' || r.type === 'task.roi' || r.type === 'task.target') {
    if (r.attrs.attrs.Anchor) {
      return null
    }
    if (r.type === 'task.roi' && r.prevRef) {
      return null
    }
    return r.target
  } else {
    return null
  }
}

export function isAnchorRef(r: TaskRefInfo): r is TaskRefInfo & {
  type: 'task.next' | 'task.roi' | 'task.target'
  attrs: { attrs: { Anchor: true } }
} {
  return (
    (r.type === 'task.next' || r.type === 'task.roi' || r.type === 'task.target') &&
    !!r.attrs.attrs.Anchor
  )
}

export function findMaaDeclRef<T extends { offset: number; length: number }>(
  infos: T[],
  offset: number
): T | null {
  for (const info of infos) {
    if (offset >= info.offset && offset <= info.offset + info.length) {
      return info
    }
  }
  return null
}
