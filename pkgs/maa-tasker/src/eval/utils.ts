import { TaskBaseProps, TaskExprProps } from '../props'
import type { MaaTask, MaaTaskExpr } from '../types'
import type { MaaTaskBaseNotResolved, MaaTaskBaseResolved, MaaTaskWithTraceInfo } from './types'

export function isTaskResolved(task: MaaTask): task is MaaTaskBaseResolved {
  return !!task.__baseTaskResolved
}
export function isTaskNotResolved(task: MaaTask): task is MaaTaskBaseNotResolved {
  return !task.__baseTaskResolved
}

export function removeDuplicated(input: string[], keepLast = false): string[] {
  const inputSet = new Set(input)
  if (keepLast) {
    input = input.toReversed()
  }
  input = input.filter(task => {
    if (inputSet.has(task)) {
      inputSet.delete(task)
      return true
    } else {
      return false
    }
  })
  if (keepLast) {
    input.reverse()
  }
  return input
}

// will modify segs
export function removeDuplicatedPrefix(segs: string[]) {
  const last = segs.pop()!
  return [...removeDuplicated(segs, true), last].join('@')
}

type MergeMode = '@' | 'baseTask'
export function mergeTask(
  base: MaaTaskWithTraceInfo<MaaTaskBaseResolved>,
  inherit: MaaTaskWithTraceInfo<MaaTaskBaseResolved>,
  mode: MergeMode
): MaaTaskWithTraceInfo<MaaTaskBaseResolved>
export function mergeTask(
  base: MaaTaskWithTraceInfo<MaaTaskBaseResolved>,
  inherit: MaaTaskWithTraceInfo<MaaTaskBaseNotResolved>,
  mode: MergeMode
): MaaTaskWithTraceInfo<MaaTaskBaseNotResolved>
export function mergeTask(
  base: MaaTaskWithTraceInfo<MaaTaskBaseResolved>,
  inherit: MaaTaskWithTraceInfo<MaaTask>,
  mode: MergeMode
): MaaTaskWithTraceInfo<MaaTask>
export function mergeTask(
  base: MaaTaskWithTraceInfo<MaaTaskBaseResolved>,
  inherit: MaaTaskWithTraceInfo<MaaTask>,
  mode: MergeMode
): MaaTaskWithTraceInfo<MaaTask> {
  if (mode === '@' && inherit.task.baseTask) {
    return inherit
  }

  const result: MaaTaskWithTraceInfo<MaaTask> = {
    self: inherit.self,
    task: {},
    trace: {}
  }
  if (
    inherit.task.algorithm &&
    (base.task.algorithm ?? 'MatchTemplate') !== inherit.task.algorithm
  ) {
    for (const key of TaskBaseProps) {
      if (inherit.task[key] !== undefined) {
        result.task[key] = inherit.task[key] as any
        result.trace[key] = inherit.self
      } else if (base.task[key] !== undefined) {
        result.task[key] = base.task[key] as any
        result.trace[key] = base.self
      }
    }
  } else {
    result.task = { ...base.task }
    result.trace = { ...base.trace }
    for (const [key, val] of Object.entries(inherit.task)) {
      result.task[key as keyof MaaTask] = val as any
      result.trace[key] = inherit.self
    }
    if (!inherit.task.template) {
      delete result.task.template
      delete result.trace.template
    }
  }

  if (mode === 'baseTask') {
    delete result.task.baseTask
    delete result.trace.baseTask
  }

  return result
}

// tasks must not empty
export function mergeMultiPathTasks(
  tasks: MaaTaskWithTraceInfo<MaaTask>[]
): MaaTaskWithTraceInfo<MaaTask> {
  tasks = JSON.parse(JSON.stringify(tasks))
  // if (tasks.length === 0) {
  //   return null
  // }

  if (tasks.length === 1) {
    return tasks[0]
  }

  const last = tasks.pop()!

  if (last.task.baseTask) {
    // 神秘的逃逸逻辑
    if (last.task.baseTask === '#none') {
      delete last.task.baseTask
      delete last.trace.baseTask
    }
    return last
  }

  const prev = mergeMultiPathTasks(tasks)

  // 就是直接覆盖
  prev.self = last.self
  for (const [key, val] of Object.entries(last.task)) {
    prev.task[key as keyof MaaTask] = val as any
    prev.trace[key] = last.self
  }
  return prev
}

export function applyParentToTask(
  task: MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null,
  parent: string[]
): MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null {
  if (!task) {
    return null
  }

  const clonedTask = JSON.parse(JSON.stringify(task)) as MaaTaskWithTraceInfo<MaaTaskBaseResolved>
  if (!parent) {
    return clonedTask
  }

  for (const key of TaskExprProps) {
    const prev = clonedTask.task[key] as MaaTaskExpr[] | undefined
    if (prev) {
      const newPrev: MaaTaskExpr[] = []
      for (const expr of prev) {
        // 这就是 MAA
        newPrev.push((parent.join('@') + expr) as MaaTaskExpr)
      }
      clonedTask.task[key] = newPrev
      clonedTask.trace[key] = clonedTask.self
    }
  }

  return clonedTask
}
