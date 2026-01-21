import type { Node } from 'jsonc-parser'

import { type MaaTaskExpr, type MaaTaskExprAst, parseExpr } from '@nekosu/maa-tasker'

import type { TaskName } from '../../../utils/types'
import { isString, parseArray } from '../../utils'
import type { TaskInfo, TaskMaaTaskRef, TaskParseContext } from '../task'

function calcSuffix(list: TaskMaaTaskRef[]) {
  if (list.length === 0) {
    return
  }
  let current = list[0].task
  list.shift()
  while (list.length > 0) {
    const next = list.shift()!
    current = `${next.task}@${current}` as TaskName
    next.taskSuffix = current
  }
}

function parseMaaExprTask(ast: MaaTaskExprAst, tasks: TaskMaaTaskRef[]) {
  switch (ast.type) {
    case 'task':
      tasks.push({
        task: ast.task as TaskName,
        taskSuffix: ast.task as TaskName,
        offset: ast.range[0],
        length: ast.range[1]
      })
      return tasks[tasks.length - 1]
    case 'brace':
      parseMaaExprTask(ast.list, tasks)
      break
    case '@': {
      let list: TaskMaaTaskRef[] = []
      for (const sub of ast.list) {
        const next = parseMaaExprTask(sub, tasks)
        if (next) {
          list.unshift(next)
        } else {
          calcSuffix(list)
          list = []
        }
      }
      calcSuffix(list)
      break
    }
    case '#':
      break
    case '*':
      parseMaaExprTask(ast.list, tasks)
      break
    case '+':
    case '^':
      parseMaaExprTask(ast.left, tasks)
      parseMaaExprTask(ast.right, tasks)
      break
  }
}

export function parseMaaExpr(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  if (isString(node)) {
    const tasks: TaskMaaTaskRef[] = []
    info.refs.push({
      file: ctx.file,
      location: node,
      type: 'task.maa.expr',
      target: node.value as MaaTaskExpr,
      tasks
    })
    try {
      const ast = parseExpr(node.value as MaaTaskExpr)
      parseMaaExprTask(ast, tasks)
    } catch {}
  }
}

export function parseMaaExprList(node: Node, info: TaskInfo, ctx: TaskParseContext) {
  for (const obj of parseArray(node)) {
    parseMaaExpr(obj, info, ctx)
  }
}
