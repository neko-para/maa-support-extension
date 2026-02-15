import type { Node } from 'jsonc-parser'

import { isNumber, isString, parseArray, parseObject } from '../utils'
import type { TaskInfo, TaskParseContext } from './task'

function isColor(node: Node) {
  let length = 0
  for (const obj of parseArray(node)) {
    if (!isNumber(obj)) {
      return false
    }
    length += 1
  }
  return length === 3
}

function parseColorSingle(
  node: Node,
  info: TaskInfo,
  ctx: TaskParseContext,
  method: 'rgb' | 'hsv'
) {
  const color: number[] = []
  for (const obj of parseArray(node)) {
    if (isNumber(obj)) {
      color.push(obj.value)
    }
  }
  info.refs.push({
    location: node,
    file: ctx.file,
    type: 'task.color',
    method,
    color
  })
}

export function parseColor(
  node: Node,
  info: TaskInfo,
  ctx: TaskParseContext,
  method: 'rgb' | 'hsv'
) {
  if (isColor(node)) {
    parseColorSingle(node, info, ctx, method)
  } else {
    for (const item of parseArray(node)) {
      if (isColor(item)) {
        parseColorSingle(node, info, ctx, method)
      }
    }
  }
}
