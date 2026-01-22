import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { isBool, isString, parseArray, parseObject } from '../utils'
import type { TaskInfo, TaskNextRefInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    const ref: TaskNextRefInfo = {
      type: 'task.next',
      target: '' as TaskName,
      objMode: false
    }
    let name = node.value
    let offset = 0
    while (true) {
      if (name.startsWith('[JumpBack]')) {
        ref.jumpBack = true
        name = name.substring(10)
        offset += 10
        continue
      }
      if (name.startsWith('[Anchor]')) {
        ref.anchor = true
        name = name.substring(8)
        offset += 8
        continue
      }
      break
    }
    ref.target = name as TaskName
    ref.offset = offset
    info.refs.push({
      file: ctx.file,
      location: node,
      ...ref
    })
  } else if (node.type === 'object') {
    let loc: Node | null = null
    const ref: TaskNextRefInfo = {
      type: 'task.next',
      target: '' as TaskName,
      objMode: true
    }
    for (const [key, obj] of parseObject(node)) {
      if (key === 'name' && isString(obj)) {
        ref.target = obj.value as TaskName
        loc = obj
      } else if (key === 'jump_back' && isBool(obj)) {
        ref.jumpBack = obj.value
      } else if (key === 'anchor' && isBool(obj)) {
        ref.anchor = obj.value
      }
    }
    if (loc) {
      info.refs.push({
        file: ctx.file,
        location: loc,
        ...ref
      })
    }
  }
}

export function parseNextList(
  node: Node,
  info: TaskInfo,
  ctx: TaskParseContext,
  forceArray = false
) {
  if (!forceArray && node.type !== 'array') {
    parseSingle(node, info, ctx)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info, ctx)
    }
  }
}
