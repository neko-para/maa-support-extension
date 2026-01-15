import type { Node } from 'jsonc-parser'

import { isBool, isString, parseArray, parseObject } from '../utils'
import type { TaskInfo, TaskNextRefInfo, TaskRefInfo } from './task'

function parseSingle(node: Node, info: TaskInfo) {
  if (isString(node)) {
    const ref: TaskNextRefInfo = {
      type: 'task.next',
      target: ''
    }
    let name = node.value
    while (true) {
      if (name.startsWith('[JumpBack]')) {
        ref.jumpBack = true
        name = name.substring('[JumpBack]'.length)
        continue
      }
      if (name.startsWith('[Anchor]')) {
        ref.anchor = true
        name = name.substring('[Anchor]'.length)
        continue
      }
      break
    }
    ref.target = name
    info.refs.push({
      location: node,
      ...ref
    })
  } else if (node.type === 'object') {
    let loc: Node | null = null
    const ref: TaskNextRefInfo = {
      type: 'task.next',
      target: ''
    }
    for (const [key, obj] of parseObject(node)) {
      if (key === 'name' && isString(obj)) {
        ref.target = obj.value
        loc = obj
      } else if (key === 'jump_back' && isBool(obj)) {
        ref.jumpBack = obj.value
      } else if (key === 'anchor' && isBool(obj)) {
        ref.anchor = obj.value
      }
    }
    if (loc && ref.target.length > 0) {
      info.refs.push({
        location: loc,
        ...(ref as TaskNextRefInfo)
      })
    }
  }
}

export function parseNextList(node: Node, info: TaskInfo) {
  if (node.type !== 'array') {
    parseSingle(node, info)
  } else {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info)
    }
  }
}
