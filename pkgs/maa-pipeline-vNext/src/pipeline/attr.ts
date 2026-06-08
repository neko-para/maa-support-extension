export type TaskAttrInfo<Keys extends string> = {
  offset: number
  attrs: { [key in Keys]?: boolean }
  unknown: [attr: string, offset: number, length: number][]
}

export function parseAttr<Keys extends string>(name: string, keys: readonly Keys[]) {
  const info: TaskAttrInfo<Keys> = {
    offset: 0,
    attrs: {},
    unknown: []
  }
  const knownSet = new Set<string>(keys)
  const re = /^\[([^\]]+)\]/

  let m: RegExpExecArray | null
  while ((m = re.exec(name))) {
    const key = m[1]
    const len = m[0].length
    if (knownSet.has(key)) {
      info.attrs[key as Keys] = true
    } else {
      info.unknown.push([key, info.offset, len])
    }
    info.offset += len
    name = name.slice(len)
  }
  return [name, info] as const
}
