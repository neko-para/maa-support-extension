export type TaskAttrInfo<Keys extends string> = {
  // 节点名称的偏移
  offset: number
  attrs: {
    [key in Keys]?: boolean
  }
  unknown: [attr: string, offset: number, length: number][]
}

export function parseAttr<Keys extends string>(
  name: string,
  keys: Keys[]
): [name: string, info: TaskAttrInfo<Keys>] {
  const info: TaskAttrInfo<Keys> = {
    offset: 0,
    attrs: {},
    unknown: []
  }

  let offset = 0
  while (true) {
    let found = false
    for (const key of keys) {
      const prefix = `[${key}]`
      if (name.startsWith(prefix)) {
        info.attrs[key] = true
        name = name.substring(prefix.length)
        offset += prefix.length
        found = true
        break
      }
    }
    if (found) {
      continue
    }
    const match = /^\[([^\]]+)\]/.exec(name)
    if (match) {
      info.unknown.push([match[1], offset, match[1].length + 2])
      name = name.substring(match[1].length + 2)
      offset += match[1].length + 2
      continue
    }
    break
  }
  info.offset = offset
  return [name, info]
}
