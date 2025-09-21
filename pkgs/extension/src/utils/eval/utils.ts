import { addParentToExpr } from './expr'
import { MaaTask, MaaTaskBaseProps, MaaTaskExpr, MaaTaskExprProps } from './types'

export type MaaTaskBaseNotResolved = MaaTask & { __baseTaskResolved?: false }
export type MaaTaskBaseResolved = MaaTask & { __baseTaskResolved: true }

export function isTaskResolved(task: MaaTask): task is MaaTaskBaseResolved {
  return !!task.__baseTaskResolved
}
export function isTaskNotResolved(task: MaaTask): task is MaaTaskBaseNotResolved {
  return !task.__baseTaskResolved
}

type MergeMode = '@' | 'baseTask'
export function mergeTask(
  base: MaaTaskBaseResolved,
  inherit: MaaTaskBaseResolved,
  mode: MergeMode
): MaaTaskBaseResolved
export function mergeTask(
  base: MaaTaskBaseResolved,
  inherit: MaaTaskBaseNotResolved,
  mode: MergeMode
): MaaTaskBaseNotResolved
export function mergeTask(base: MaaTaskBaseResolved, inherit: MaaTask, mode: MergeMode): MaaTask
export function mergeTask(base: MaaTaskBaseResolved, inherit: MaaTask, mode: MergeMode): MaaTask {
  if (mode === '@' && inherit.baseTask) {
    return inherit
  }

  const result: MaaTask = {}
  if ((base.algorithm ?? 'MatchTemplate') != (inherit.algorithm ?? 'MatchTemplate')) {
    for (const key of MaaTaskBaseProps) {
      result[key] = (inherit[key] ?? base[key]) as any
    }
  } else {
    const result: MaaTask = { ...base }
    Object.assign(result, inherit)
    if (!inherit.template) {
      delete result.template
    }
  }

  if (mode === 'baseTask') {
    delete result.baseTask
  }

  return result
}

export function mergeMultiPathTasks(tasks: MaaTask[]): MaaTask | null {
  tasks = [...tasks]
  if (tasks.length === 0) {
    return null
  }

  if (tasks.length === 1) {
    return tasks[0]
  }

  const last = tasks.pop()!

  if (last.baseTask) {
    // 神秘
    if (last.baseTask === '#none') {
      delete last.baseTask
    }
    return last
  }

  const prev = mergeMultiPathTasks(tasks)
  if (!prev) {
    return null
  }

  // 就是直接覆盖
  Object.assign(prev, last)
  return prev
}

export function applyParentToTask(
  task: MaaTaskBaseResolved | null,
  parent: string[]
): MaaTaskBaseResolved | null {
  if (!task) {
    return null
  }

  const clonedTask = JSON.parse(JSON.stringify(task))
  if (!parent) {
    return clonedTask
  }

  for (const key of MaaTaskExprProps) {
    const prev = clonedTask[key] as MaaTaskExpr[] | undefined
    if (prev) {
      const newPrev: MaaTaskExpr[] = []
      for (const expr of prev) {
        const newExpr = addParentToExpr(expr, parent)
        if (!newExpr) {
          return null
        }
        newPrev.push(newExpr)
      }
      clonedTask[key] = newPrev
    }
  }

  return clonedTask
}
