import type { Node } from 'jsonc-parser'

import type { MaaExprName } from '../../../utils/types'
import { isString, parseArray } from '../../utils'
import type { TaskInfo, TaskParseContext } from '../task'

function parseMaaExprTask(node: Node, info: TaskInfo, ctx: TaskParseContext) {}

export function parseMaaExpr(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.maa.expr',
      target: node.value as MaaExprName
    })
    parseMaaExprTask(node, info, ctx)
  }
}

export function parseMaaExprList(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const obj of parseArray(node)) {
    parseMaaExpr(obj, info, ctx)
  }
}
