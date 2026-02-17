import type { Node } from 'jsonc-parser'

import type { AnchorName, TaskName } from '../../utils/types'
import { isString, parseArray, parseObject, parseObjectFlex } from '../utils'
import type { TaskDeclInfo, TaskInfo, TaskParseContext } from './task'

function parseSingle(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    info.decls.push({
      file: ctx.file,
      location: node,
      type: 'task.anchor',
      anchor: node.value as AnchorName,
      task: ctx.taskName,
      belong: ctx.taskName
    })
  }
}
export function parseAnchor(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    parseSingle(node, info, ctx)
  } else if (node.type === 'array') {
    for (const obj of parseArray(node)) {
      parseSingle(obj, info, ctx)
    }
  } else {
    for (const [key, obj, prop] of parseObjectFlex(node)) {
      if (obj && isString(obj)) {
        info.decls.push({
          file: ctx.file,
          location: prop,
          type: 'task.anchor',
          anchor: key as AnchorName,
          task: obj.value as TaskName,
          belong: ctx.taskName
        })
        info.refs.push({
          file: ctx.file,
          location: obj,
          type: 'task.anchor',
          target: obj.value as TaskName
        })
      } else {
        info.decls.push({
          file: ctx.file,
          location: prop,
          type: 'task.anchor',
          anchor: key as AnchorName,
          task: '' as TaskName,
          belong: ctx.taskName
        })
      }
    }
  }
}
