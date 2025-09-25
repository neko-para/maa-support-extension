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

export interface MaaEvalDelegate {
  query(task: string): Promise<[task: MaaTask, anchor: string][]>

  taskLoopDetected(tasks: string[]): void
  exprPropLoopDetected(exprs: string[]): void
  cannotFoundTask(task: string, prefix: string[]): void
  warnCannotFoundBaseTask(task: string): void
  parseExprError(expr: MaaTaskExpr, err: string): void
  exprTooLarge(count: number): void
}

export class MaaEvalContext {
  impl: MaaEvalContextImpl

  constructor(delegate: MaaEvalDelegate) {
    this.impl = new MaaEvalContextImpl(delegate)
  }

  async evalTask(task: string): Promise<MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null> {
    return await this.impl.evalTask(task, {
      taskChain: [],
      exprGetPropChain: []
    })
  }

  async evalExpr(expr: MaaTaskExpr, self: string, strip: boolean = true): Promise<string[] | null> {
    return await this.impl.evalExpr(expr, self, strip, {
      taskChain: [],
      exprGetPropChain: []
    })
  }
}

class MaaEvalContextImpl {
  delegate: MaaEvalDelegate
  cache: Record<string, MaaTaskWithTraceInfo<MaaTaskBaseResolved>> = {}

  constructor(delegate: MaaEvalDelegate) {
    this.delegate = delegate
  }

  async evalTask(
    task: string | string[],
    context: ChainContext
  ): Promise<MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null> {
    if (typeof task === 'string') {
      task = task.split('@')
    } else {
      task = [...task]
    }

    return this.evalTaskImpl(removeDuplicatedPrefix(task), [], context)
  }

  async evalExpr(
    expr: MaaTaskExpr | MaaTaskExprAst,
    self: string,
    strip: boolean,
    context: ChainContext
  ): Promise<string[] | null> {
    if (typeof expr === 'string') {
      try {
        expr = parseExpr(expr)
      } catch (err) {
        this.delegate.parseExprError(expr as MaaTaskExpr, `${err}`)
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
        result = await this.evalExpr(ast.list, self, false, context)
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
          const stage = await this.evalExpr(list, self, false, context)
          if (!stage) {
            return null
          }
          stages.push(stage)
          count *= stage.length
        }
        if (count > 100000) {
          this.delegate.exprTooLarge(count)
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
              const res = await this.getNextList(p, ast.virt, self, context)
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
        const list = await this.evalExpr(ast.list, self, false, context)
        if (!list) {
          return null
        }
        result = Array.from({ length: ast.count }, () => [...list]).flat()
        break
      }
      case '+': {
        const left = await this.evalExpr(ast.left, self, false, context)
        const right = await this.evalExpr(ast.right, self, false, context)
        if (!left || !right) {
          return null
        }
        result = [...left, ...right]
        break
      }
      case '^': {
        const left = await this.evalExpr(ast.left, self, false, context)
        const right = await this.evalExpr(ast.right, self, false, context)
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

  async evalTaskImpl(
    task: string,
    parent: string[],
    context: ChainContext
  ): Promise<MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null> {
    const key = `${parent.join('@')}:${task}`

    const name = [...parent, task].join('@')
    if (this.cache[name]) {
      return this.cache[name]
    }

    if (context.taskChain.indexOf(key) !== -1) {
      context.taskChain.push(key)
      this.delegate.taskLoopDetected(context.taskChain)
      return null
    }

    context.taskChain.push(key)

    // 禁用flush，并且禁用回退
    const infos = (await this.delegate.query(task)).map(([obj, anchor]) => {
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
        this.delegate.cannotFoundTask(task, parent)
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
        const result = applyParentToTask(await this.resolveBaseTask(info, context), parent)
        if (result) {
          this.cache[name] = result
        }
        context.taskChain.pop()
        return result
      } else {
        const seg = segs.shift()!
        const base = await this.evalTask(segs, context)
        if (!base) {
          this.delegate.warnCannotFoundBaseTask(segs.join('@'))
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

  async resolveBaseTask(
    task: MaaTaskWithTraceInfo<MaaTask>,
    context: ChainContext
  ): Promise<MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null> {
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

      const base = await this.evalTask(task.task.baseTask, context)
      if (!base) {
        return null
      }

      return this.resolveBaseTask(mergeTask(base, task, 'baseTask'), context)
    }

    return null
  }

  async getNextList(
    task: string,
    prop: PropsVirts,
    self: string,
    context: ChainContext
  ): Promise<string[] | null> {
    const key = `${task}.${prop}`

    if (context.exprGetPropChain.indexOf(key) !== -1) {
      context.exprGetPropChain.push(key)
      this.delegate.exprPropLoopDetected(context.exprGetPropChain)
      return null
    }

    context.exprGetPropChain.push(key)

    const obj = await this.evalTask(task, context)
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

      const res = await this.evalExpr(ast, self, shouldStrip(prop), context)
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
