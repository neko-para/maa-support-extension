import { MaaTaskExprAst, parseExpr } from '../expr'
import { shouldStrip } from '../props'
import { MaaTask, MaaTaskExpr, PropsVirts } from '../types'
import { MaaTaskBaseResolved, MaaTaskWithTraceInfo, MaaTraceAnchor } from './types'
import {
  applyParentToTask,
  isTaskNotResolved,
  isTaskResolved,
  mergeMultiPathTasks,
  mergeTask,
  removeDuplicated,
  removeDuplicatedPrefix
} from './utils'

type ChainContext = {
  taskChain: string[]
  exprGetPropChain: string[]
}

export class MaaErrorDelegate {
  taskLoopDetected(tasks: string[]): void {
    console.error(`task loop detected ${tasks.join(' -> ')}`)
  }

  exprPropLoopDetected(exprs: string[]): void {
    console.error(`expr loop detected ${exprs.join(' -> ')}`)
  }

  cannotFindTask(task: string, prefix: string[]): void {
    console.error(`cannot find task ${task} with parent ${prefix}`)
  }

  warnCannotFindBaseTask(task: string): void {
    console.warn(`cannot find base task ${task}`)
  }

  parseExprError(expr: MaaTaskExpr, err: string): void {
    console.error(`parse expr ${expr} failed with error ${err}`)
  }

  exprTooLarge(count: number): void {
    console.error(`expr expand too large ${count}`)
  }
}

export class MaaEvalDelegate {
  error: MaaErrorDelegate

  constructor(error: MaaErrorDelegate) {
    this.error = error
  }

  query(task: string): [task: MaaTask, anchor: string][] {
    return []
  }
}

export class MaaEvalContext {
  impl: MaaEvalContextImpl

  constructor(delegate: MaaEvalDelegate) {
    this.impl = new MaaEvalContextImpl(delegate)
  }

  evalTask(task: string): MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null {
    return this.impl.evalTask(task, {
      taskChain: [],
      exprGetPropChain: []
    })
  }

  evalExpr(expr: MaaTaskExpr, self: string, strip: boolean = true): string[] | null {
    return this.impl.evalExpr(expr, self, strip, {
      taskChain: [],
      exprGetPropChain: []
    })
  }

  cleanCache() {
    this.impl.cache = {}
  }
}

class MaaEvalContextImpl {
  delegate: MaaEvalDelegate
  cache: Record<string, MaaTaskWithTraceInfo<MaaTaskBaseResolved>> = {}

  constructor(delegate: MaaEvalDelegate) {
    this.delegate = delegate
  }

  evalTask(
    task: string | string[],
    context: ChainContext
  ): MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null {
    if (typeof task === 'string') {
      task = task.split('@')
    } else {
      task = [...task]
    }

    return this.evalTaskImpl(removeDuplicatedPrefix(task), [], context)
  }

  evalExpr(
    expr: MaaTaskExpr | MaaTaskExprAst,
    self: string,
    strip: boolean,
    context: ChainContext
  ): string[] | null {
    if (typeof expr === 'string') {
      try {
        expr = parseExpr(expr)
      } catch (err) {
        this.delegate.error.parseExprError(expr as MaaTaskExpr, `${err}`)
        return null
      }
    }
    const ast = expr

    let result: string[] | null
    switch (ast.type) {
      case 'task':
        result = [ast.task]
        break
      case 'brace':
        result = this.evalExpr(ast.list, self, false, context)
        break
      case '#':
        switch (ast.virt) {
          case 'none':
            result = []
            break
          case 'self':
            result = [self]
            break
          case 'back':
            result = []
            break
          case 'next':
          case 'sub':
          case 'exceeded_next':
          case 'on_error_next':
          case 'reduce_other_times':
            result = []
            break
        }
        break
      case '@': {
        const stages: string[][] = []
        let count = 1
        for (const list of ast.list) {
          const stage = this.evalExpr(list, self, false, context)
          if (!stage) {
            return null
          }
          stages.push(stage)
          count *= stage.length
        }
        if (count > 100000) {
          this.delegate.error.exprTooLarge(count)
          return null
        }
        while (stages.length > 1) {
          const first = stages.shift()!
          const second = stages.shift()!
          const output: string[] = []
          for (const f of first) {
            for (const s of second) {
              output.push(`${f}@${s}`)
            }
          }
          stages.unshift(output)
        }

        const expand = stages.shift()!.map(task => removeDuplicatedPrefix(task.split('@')))

        switch (ast.virt) {
          case undefined:
            result = expand
            break
          case 'none':
            result = []
            break
          case 'self':
            result = expand.map(() => self) ?? null
            break
          case 'back':
            result = expand
            break
          case 'next':
          case 'sub':
          case 'exceeded_next':
          case 'on_error_next':
          case 'reduce_other_times':
            result = []
            for (const p of expand) {
              const res = this.getNextList(p, ast.virt, self, context)
              if (!res) {
                return null
              }
              result.push(...res)
            }
            break
        }
        break
      }
      case '*': {
        const list = this.evalExpr(ast.list, self, false, context)
        if (!list) {
          return null
        }
        result = Array.from({ length: ast.count }, () => [...list]).flat()
        break
      }
      case '+': {
        const left = this.evalExpr(ast.left, self, false, context)
        const right = this.evalExpr(ast.right, self, false, context)
        if (!left || !right) {
          return null
        }
        result = [...left, ...right]
        break
      }
      case '^': {
        const left = this.evalExpr(ast.left, self, false, context)
        const right = this.evalExpr(ast.right, self, false, context)
        if (!left || !right) {
          return null
        }
        const rightSet = new Set(right)
        result = left.filter(task => !rightSet.has(task))
        break
      }
    }

    if (!result) {
      return null
    }

    if (strip) {
      result = removeDuplicated(result)
    }

    return result
  }

  evalTaskImpl(
    task: string,
    parent: string[],
    context: ChainContext
  ): MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null {
    const key = `${parent.join('@')}:${task}`

    const name = [...parent, task].join('@')
    if (this.cache[name]) {
      return this.cache[name]
    }

    if (context.taskChain.indexOf(key) !== -1) {
      context.taskChain.push(key)
      this.delegate.error.taskLoopDetected(context.taskChain)
      return null
    }

    context.taskChain.push(key)

    // 禁用flush，并且禁用回退
    const infos = this.delegate.query(task).map(([obj, anchor]) => {
      const selfAnchor: MaaTraceAnchor = {
        task: name,
        anchor
      }

      return {
        self: selfAnchor,
        task: obj,
        trace: Object.fromEntries(Object.keys(obj).map(key => [key, selfAnchor] as const))
      } satisfies MaaTaskWithTraceInfo<MaaTask>
    })

    const segs = task.split('@')

    if (infos.length === 0) {
      // 没有找到直接定义，递归提取@
      if (segs.length === 1) {
        this.delegate.error.cannotFindTask(task, parent)
        context.taskChain.pop()
        return null
      }

      const seg = segs.shift()!
      const result = this.evalTaskImpl(segs.join('@'), [...parent, seg], context)
      context.taskChain.pop()
      return result
    } else {
      // 找到定义了，先合并多文件
      const info = mergeMultiPathTasks(infos)

      if (info.task.baseTask || segs.length === 1) {
        // 有 baseTask 或者没有 @，就不用递归了
        const result = applyParentToTask(this.resolveBaseTask(info, context), parent)
        if (result) {
          this.cache[name] = result
        }
        context.taskChain.pop()
        return result
      } else {
        const seg = segs.shift()!
        const base = this.evalTask(segs, context)
        if (!base) {
          this.delegate.error.warnCannotFindBaseTask(segs.join('@'))
        }

        let result: MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null = null
        if (base) {
          this.cache[segs.join('@')] = base

          const baseWithSeg = applyParentToTask(base, [seg])
          if (!baseWithSeg) {
            context.taskChain.pop()
            return null
          }

          // 没有 baseTask，一定是 resolved
          result = applyParentToTask(
            mergeTask(baseWithSeg, info as MaaTaskWithTraceInfo<MaaTaskBaseResolved>, '@'),
            parent
          )
        } else {
          // 没有 baseTask，一定是 resolved
          result = applyParentToTask(info as MaaTaskWithTraceInfo<MaaTaskBaseResolved>, parent)
        }
        if (result) {
          this.cache[name] = result
        }
        context.taskChain.pop()
        return result
      }
    }
  }

  resolveBaseTask(
    task: MaaTaskWithTraceInfo<MaaTask>,
    context: ChainContext
  ): MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null {
    if (isTaskResolved(task.task)) {
      return task as MaaTaskWithTraceInfo<MaaTaskBaseResolved>
    } else if (isTaskNotResolved(task.task)) {
      if (!task.task.baseTask) {
        return {
          self: task.self,
          task: { ...task.task, __baseTaskResolved: true },
          trace: task.trace
        }
      }

      const base = this.evalTask(task.task.baseTask, context)
      if (!base) {
        return null
      }

      return this.resolveBaseTask(mergeTask(base, task, 'baseTask'), context)
    }

    return null
  }

  getNextList(
    task: string,
    prop: PropsVirts,
    self: string,
    context: ChainContext
  ): string[] | null {
    const key = `${task}.${prop}`

    if (context.exprGetPropChain.indexOf(key) !== -1) {
      context.exprGetPropChain.push(key)
      this.delegate.error.exprPropLoopDetected(context.exprGetPropChain)
      return null
    }

    context.exprGetPropChain.push(key)

    const obj = this.evalTask(task, context)
    if (!obj) {
      context.exprGetPropChain.pop()
      return null
    }

    let rawResult: string[]
    switch (prop) {
      case 'next':
        rawResult = obj.task.next ?? []
        break
      case 'sub':
        rawResult = obj.task.sub ?? []
        break
      case 'exceeded_next':
        rawResult = obj.task.exceededNext ?? []
        break
      case 'on_error_next':
        rawResult = obj.task.onErrorNext ?? []
        break
      case 'reduce_other_times':
        rawResult = obj.task.reduceOtherTimes ?? []
        break
    }

    const result: string[] = []
    for (const expr of rawResult) {
      const ast = parseExpr(expr as MaaTaskExpr)
      if (!ast) {
        context.exprGetPropChain.pop()
        return null
      }

      const res = this.evalExpr(ast, self, shouldStrip(prop), context)
      if (!res) {
        context.exprGetPropChain.pop()
        return null
      }

      result.push(...res)
    }

    context.exprGetPropChain.pop()
    return result
  }
}
