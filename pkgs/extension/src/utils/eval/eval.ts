import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { taskIndexService } from '../../service'
import { isMaaAssistantArknights } from '../fs'
import { addParent, addParentToExpr, parseExpr } from './expr'
import { MaaTask, MaaTaskBaseProps, MaaTaskExpr, MaaTaskExprProps } from './types'
import {
  MaaTaskBaseResolved,
  applyParentToTask,
  isTaskNotResolved,
  isTaskResolved,
  mergeMultiPathTasks,
  mergeTask
} from './utils'

export async function maaEvalTask(task: string): Promise<MaaTask | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  const ctx = new EvalContext()

  const result = await ctx.evalTask(task)
  if (result) {
    delete (result as MaaTask).__baseTaskResolved
  }
  return result
}

export async function maaEvalExpr(expr: MaaTaskExpr): Promise<string[] | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  return await maaEvalExprImpl(expr)
}

class EvalContext {
  cache: Record<string, MaaTaskBaseResolved> = {}
  evalChain: string[] = []

  async evalTask(task: string, parent: string[] = []): Promise<MaaTaskBaseResolved | null> {
    const name = [...parent, task].join('@')
    if (this.cache[name]) {
      return this.cache[name]
    }

    if (this.evalChain.indexOf(name) !== -1) {
      this.evalChain.push(name)
      vscode.window.showErrorMessage(`检测到循环 ${this.evalChain.join(' -> ')}`)
      return null
    }

    this.evalChain.push(name)

    // 禁用flush，并且禁用回退
    const infos = (await taskIndexService.queryTask(task, undefined, undefined, false, false)).map(
      x => JSON.parse(x.info.taskContent) as MaaTask
    )

    const segs = task.split('@')

    if (infos.length === 0) {
      // 没有找到直接定义，递归提取@
      if (segs.length === 1) {
        logger.error('cannot find', task, 'with parent', parent)
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
        logger.error('cannot merge', task, 'with parent', parent)
        this.evalChain.pop()
        return null
      }

      if (info.baseTask || segs.length === 1) {
        // 有 baseTask 或者没有 @，就不用递归了
        const result = applyParentToTask(await this.resolveBaseTask(info), parent)
        if (result) {
          this.cache[name] = result
        }
        this.evalChain.pop()
        return result
      } else {
        segs.shift()
        const base = await this.evalTask(segs.join('@'))
        if (!base) {
          this.evalChain.pop()
          return null
        }
        this.cache[segs.join('@')] = base

        // 没有 baseTask，一定是 resolved
        const result = applyParentToTask(mergeTask(base, info as MaaTaskBaseResolved, '@'), parent)
        if (result) {
          this.cache[name] = result
        }
        this.evalChain.pop()
        return result
      }
    }
  }

  async resolveBaseTask(task: MaaTask): Promise<MaaTaskBaseResolved | null> {
    if (isTaskResolved(task)) {
      return task
    } else if (isTaskNotResolved(task)) {
      if (!task.baseTask) {
        return { ...task, __baseTaskResolved: true }
      }

      const base = await this.evalTask(task.baseTask)
      if (!base) {
        logger.error('resolve base task failed', task.baseTask)
        return null
      }

      return this.resolveBaseTask(mergeTask(base, task, 'baseTask'))
    }

    return null
  }
}

async function maaEvalExprImpl(expr: MaaTaskExpr): Promise<string[] | null> {
  const ast = parseExpr(expr)
  if (!ast) {
    logger.error('parse expr error', expr)
    return null
  }

  // const taskInfos = await taskIndexService.queryTask(expr)
  // if (!taskInfos.length) {
  //   return null
  // }

  // const lastInfo = taskInfos[taskInfos.length - 1]
  // return JSON.parse(lastInfo.info.taskContent)

  return []
}
