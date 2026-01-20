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
  if (r.type === 'task.target' || r.type === 'task.entry') {
    return r.target
  } else if (r.type === 'task.next') {
    return !r.anchor ? r.target : null
  } else if (r.type === 'task.roi') {
    return r.prevRef ? null : r.target
  } else {
    return null
  }
}
