import type { Node } from 'jsonc-parser'

export function filterDeclRef<T extends { location: Node }>(infos: T[], offset: number) {
  return infos.filter(
    info => info.location.offset <= offset && info.location.offset + info.location.length > offset
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
