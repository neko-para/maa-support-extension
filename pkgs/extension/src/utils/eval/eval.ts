import * as vscode from 'vscode'

import { logger } from '@mse/utils'

import { rootService, taskIndexService } from '../../service'
import { isMaaAssistantArknights } from '../fs'
import { addParent, addParentToExpr, parseExpr } from './expr'
import { MaaTask, MaaTaskBaseProps, MaaTaskExpr, MaaTaskExprProps } from './types'
import {
  MaaTaskBaseResolved,
  MaaTaskWithTraceInfo,
  applyParentToTask,
  isTaskNotResolved,
  isTaskResolved,
  mergeMultiPathTasks,
  mergeTask
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

export async function maaEvalExpr(expr: MaaTaskExpr): Promise<string[] | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  return await maaEvalExprImpl(expr)
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
      vscode.window.showErrorMessage(`检测到循环 ${this.evalChain.join(' -> ')}`)
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
          this.evalChain.pop()
          return null
        }
        this.cache[segs.join('@')] = base

        const baseWithSeg = applyParentToTask(base, [seg])
        if (!baseWithSeg) {
          this.evalChain.pop()
          return null
        }

        // 没有 baseTask，一定是 resolved
        const result = applyParentToTask(
          mergeTask(baseWithSeg, info as MaaTaskWithTraceInfo<MaaTaskBaseResolved>, '@'),
          parent
        )
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
        logger.error('resolve base task failed', task.task.baseTask)
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
