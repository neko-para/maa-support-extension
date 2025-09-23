import * as vscode from 'vscode'

import { logger, t } from '@mse/utils'

import { rootService, taskIndexService } from '../../service'
import { isMaaAssistantArknights } from '../fs'
import { MaaTaskExprAst, parseExpr } from './expr'
import { MaaTask, MaaTaskBaseProps, MaaTaskExpr, MaaTaskExprProps } from './types'
import {
  MaaTaskBaseResolved,
  MaaTaskWithTraceInfo,
  VirtTaskProp,
  applyParentToTask,
  isTaskNotResolved,
  isTaskResolved,
  mergeMultiPathTasks,
  mergeTask,
  shouldStrip
} from './utils'

export async function maaEvalTask(task: string): Promise<MaaTaskWithTraceInfo<MaaTask> | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  const ctx = new EvalContext()

  const result = await ctx.evalTask(task)
  if (result) {
    delete (result.task as MaaTask).__baseTaskResolved
  }
  return result
}

export async function maaEvalExpr(
  expr: MaaTaskExpr,
  host: string,
  strip: boolean
): Promise<string[] | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  const ast = parseExpr(expr)
  if (!ast) {
    return null
  }

  const ctx = new EvalContext()

  return await ctx.evalExpr(ast, host, strip)
}

class EvalContext {
  cache: Record<string, MaaTaskWithTraceInfo<MaaTaskBaseResolved>> = {}
  evalChain: string[] = []

  async evalTask(
    task: string,
    parent: string[] = []
  ): Promise<MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null> {
    const name = [...parent, task].join('@')
    if (this.cache[name]) {
      return this.cache[name]
    }

    if (this.evalChain.indexOf(name) !== -1) {
      this.evalChain.push(name)
      vscode.window.showErrorMessage(
        `${t('maa.eval.loop-detected')} ${this.evalChain.join(' -> ')}`
      )
      return null
    }

    this.evalChain.push(name)

    // 禁用flush，并且禁用回退
    const infos = (await taskIndexService.queryTask(task, undefined, undefined, false, false)).map(
      x => {
        const obj = JSON.parse(x.info.taskContent) as MaaTask

        // 这里硬编码了下逻辑
        const path = rootService.relativePathToRoot(x.uri).replaceAll('\\', '/')
        const match = /global\/(.+)\//.exec(path)
        const anchor = {
          name,
          path: match ? match[1] : 'Official'
        }

        return {
          self: anchor,
          task: obj,
          trace: Object.fromEntries(Object.keys(obj).map(key => [key, anchor] as const))
        } satisfies MaaTaskWithTraceInfo<MaaTask>
      }
    )

    const segs = task.split('@')

    if (infos.length === 0) {
      // 没有找到直接定义，递归提取@
      if (segs.length === 1) {
        logger.error(`cannot find ${task} with parent ${parent}`)
        this.evalChain.pop()
        return null
      }

      const seg = segs.shift()!
      const result = this.evalTask(segs.join('@'), [...parent, seg])
      this.evalChain.pop()
      return result
    } else {
      // 找到定义了，先合并多文件
      const info = mergeMultiPathTasks(infos)
      if (!info) {
        logger.error(`cannot merge ${task} with parent ${parent}`)
        this.evalChain.pop()
        return null
      }

      if (info.task.baseTask || segs.length === 1) {
        // 有 baseTask 或者没有 @，就不用递归了
        const result = applyParentToTask(await this.resolveBaseTask(info), parent)
        if (result) {
          this.cache[name] = result
        }
        this.evalChain.pop()
        return result
      } else {
        const seg = segs.shift()!
        const base = await this.evalTask(segs.join('@'))
        if (!base) {
          vscode.window.showWarningMessage(t('maa.eval.cannot-find-task-base', segs.join('@')))
        }

        let result: MaaTaskWithTraceInfo<MaaTaskBaseResolved> | null = null
        if (base) {
          this.cache[segs.join('@')] = base

          const baseWithSeg = applyParentToTask(base, [seg])
          if (!baseWithSeg) {
            this.evalChain.pop()
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
        this.evalChain.pop()
        return result
      }
    }
  }

  async resolveBaseTask(
    task: MaaTaskWithTraceInfo<MaaTask>
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

      const base = await this.evalTask(task.task.baseTask)
      if (!base) {
        logger.error(`resolve base task failed ${task.task.baseTask}`)
        return null
      }

      return this.resolveBaseTask(mergeTask(base, task, 'baseTask'))
    }

    return null
  }

  async getNextList(task: string, prop: VirtTaskProp): Promise<string[] | null> {
    const obj = await this.evalTask(task)
    if (!obj) {
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
      case 'on_error_next':
        rawResult = obj.task.onErrorNext ?? []
        break
      case 'exceeded_next':
        rawResult = obj.task.exceededNext ?? []
        break
      case 'reduce_other_times':
        rawResult = obj.task.reduceOtherTimes ?? []
        break
    }

    const result: string[] = []
    for (const expr of rawResult) {
      const ast = parseExpr(expr as MaaTaskExpr)
      if (!ast) {
        return null
      }

      const res = await this.evalExpr(ast, task, shouldStrip(prop))
      if (!res) {
        return null
      }

      result.push(...res)
    }

    return result
  }

  async evalExpr(ast: MaaTaskExprAst, host: string, strip = false): Promise<string[] | null> {
    let result: string[] | null
    switch (ast.type) {
      case 'task':
        result = [ast.task]
        break
      case 'brace':
        result = await this.evalExpr(ast.list, host)
        break
      case '#':
        switch (ast.virt) {
          case 'none':
            result = []
            break
          case 'self':
            result = [host]
            break
          case 'back':
            result = []
            break
          case 'next':
          case 'sub':
          case 'on_error_next':
          case 'exceeded_next':
          case 'reduce_other_times':
            result = []
            break
        }
        break
      case '@': {
        const stages: string[][] = []
        let count = 1
        for (const list of ast.list) {
          const stage = await this.evalExpr(list, host)
          if (!stage) {
            return null
          }
          stages.push(stage)
          count *= stage.length
        }
        if (count > 100000) {
          logger.error(`expr too large ${count}`)
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

        const expand = stages.shift()!

        switch (ast.virt) {
          case undefined:
            result = expand
            break
          case 'none':
            result = []
            break
          case 'self':
            result = expand.map(() => host) ?? null
            break
          case 'back':
            result = expand
            break
          case 'next':
          case 'sub':
          case 'on_error_next':
          case 'exceeded_next':
          case 'reduce_other_times':
            result = []
            for (const p of expand) {
              const res = await this.getNextList(p, ast.virt)
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
        const list = await this.evalExpr(ast.list, host)
        if (!list) {
          return null
        }
        result = Array.from({ length: ast.count }, () => [...list]).flat()
        break
      }
      case '+': {
        const left = await this.evalExpr(ast.left, host)
        const right = await this.evalExpr(ast.right, host)
        if (!left || !right) {
          return null
        }
        result = [...left, ...right]
        break
      }
      case '^': {
        const left = await this.evalExpr(ast.left, host)
        const right = await this.evalExpr(ast.right, host)
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
      const allTasks = new Set(result)
      result = result.filter(task => {
        if (allTasks.has(task)) {
          allTasks.delete(task)
          return true
        } else {
          return false
        }
      })
    }

    return result
  }
}
