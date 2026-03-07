import type { Node } from 'jsonc-parser'

import type { TaskName } from '../../utils/types'
import { isBool, isString, parseArray, parseObject } from '../utils'
import { parseAttr } from './attr'
import type { TaskInfo, TaskNextRefInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    const [target, attrs] = parseAttr(node.value, ['JumpBack', 'Anchor'] as const)

    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.next',
      target: target as TaskName,
      objMode: false,
      attrs
    })
  } else if (node.type === 'object') {
    let loc: Node | null = null
    const ref: TaskNextRefInfo = {
      type: 'task.next',
      target: '' as TaskName,
      objMode: true,
      attrs: {
        offset: 0,
        attrs: {},
        unknown: []
      }
    }
    for (const [key, obj] of parseObject(node)) {
      if (key === 'name' && isString(obj)) {
        ref.target = obj.value as TaskName
        loc = obj
      } else if (key === 'jump_back' && isBool(obj)) {
        ref.attrs.attrs.JumpBack = obj.value
      } else if (key === 'anchor' && isBool(obj)) {
        ref.attrs.attrs.Anchor = obj.value
      }
      // 其实应该填unknown的，但是格式不一样，而且对象模式deprecated了，就算了
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
