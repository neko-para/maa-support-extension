import type { Node } from 'jsonc-parser'

import { type MaaTaskExpr, type MaaTaskExprAst, parseExpr } from '@nekosu/maa-tasker'

import type { TaskName } from '../types'
import { isString, parseArray } from '../utils/parse'
import { parseTemplate, splitNode } from './parser'
import type { TaskDeclInfo, TaskInfo, TaskMaaTaskRef, TaskRefInfo } from './types'

function buildTaskRef(task: TaskName): TaskMaaTaskRef[] {
  const tasks = (task.split('@') as TaskName[]).map((t, _i, arr) => {
    const offset = arr.slice(0, _i).reduce((s, t) => s + t.length + 1, 0)
    return { task: t, taskSuffix: t, offset, length: t.length }
  })
  let suffix = tasks[tasks.length - 1].task
  for (let idx = tasks.length - 2; idx >= 0; idx--) {
    suffix = `${tasks[idx].task}@${suffix}` as TaskName
    tasks[idx].taskSuffix = suffix
  }
  return tasks
}

function calcMaaSuffix(list: TaskMaaTaskRef[]) {
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
          calcMaaSuffix(list)
          list = []
        }
      }
      calcMaaSuffix(list)
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

export function parseMaaTaskNode(
  node: Node,
  taskName: TaskName,
  taskKey: Node
): Omit<TaskInfo, 'parts'> & { parts: TaskInfo['parts'] } {
  const parts = splitNode(node, true)
  const decls: TaskDeclInfo[] = [
    { type: 'task.decl', task: taskName, tasks: buildTaskRef(taskName), location: taskKey }
  ]
  const refs: TaskRefInfo[] = []

  for (const [key, obj] of parts.base) {
    switch (key) {
      case 'baseTask':
        if (isString(obj)) {
          refs.push({
            type: 'task.maa.base_task',
            target: obj.value as TaskName,
            tasks: buildTaskRef(obj.value as TaskName),
            belong: taskName,
            location: obj
          })
        }
        break
      case 'sub':
      case 'next':
      case 'exceededNext':
      case 'onErrorNext':
      case 'reduceOtherTimes':
        for (const item of parseArray(obj)) {
          if (!isString(item)) {
            continue
          }
          const tasks: TaskMaaTaskRef[] = []
          try {
            const ast = parseExpr(item.value as MaaTaskExpr)
            parseMaaExprTask(ast, tasks)
          } catch {
            continue
          }
          refs.push({
            type: 'task.maa.expr',
            target: item.value as MaaTaskExpr,
            tasks,
            belong: taskName,
            location: item
          })
        }
        break
    }
  }

  for (const [_key, obj] of parts.reco) {
    parseTemplate(obj, refs)
  }

  return { parts, decls, refs }
}
