import * as vscode from 'vscode'

import { logger, t } from '@mse/utils'
import {
  MaaEvalContext,
  MaaEvalDelegate,
  type MaaTask,
  type MaaTaskExpr,
  type MaaTaskWithTraceInfo
} from '@nekosu/maa-tasker'

import { rootService, taskIndexService } from '../service'
import { isMaaAssistantArknights } from './fs'

class MaaEvalDelegateImpl extends MaaEvalDelegate {
  async query(task: string): Promise<[task: MaaTask, anchor: string][]> {
    return (await taskIndexService.queryTask(task, undefined, undefined, false, false)).map(x => {
      const obj = JSON.parse(x.info.taskContent) as MaaTask

      // 这里硬编码了下逻辑
      const path = rootService.relativePathToRoot(x.uri).replaceAll('\\', '/')
      const match = /global\/(.+)\//.exec(path)
      const anchor = match ? match[1] : 'Official'

      return [obj, anchor]
    })
  }

  taskLoopDetected(tasks: string[]): void {
    vscode.window.showErrorMessage(`${t('maa.eval.loop-detected')} ${tasks.join(' -> ')}`)
  }

  exprPropLoopDetected(exprs: string[]): void {
    vscode.window.showErrorMessage(`${t('maa.eval.loop-detected')} ${exprs.join(' -> ')}`)
  }

  cannotFindTask(task: string, prefix: string[]): void {
    logger.error(`cannot find ${task} with parent ${prefix}`)
  }

  warnCannotFindBaseTask(task: string): void {
    vscode.window.showWarningMessage(t('maa.eval.cannot-find-task-base', task))
  }

  parseExprError(expr: MaaTaskExpr, err: string): void {
    logger.error(`parse expr failed ${expr} error ${err}`)
  }

  exprTooLarge(count: number): void {
    logger.error(`expr too large ${count}`)
  }
}

export async function maaEvalTask(task: string): Promise<MaaTaskWithTraceInfo<MaaTask> | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  const context = new MaaEvalContext(new MaaEvalDelegateImpl())

  const result = await context.evalTask(task)
  if (result) {
    delete (result.task as MaaTask).__baseTaskResolved
  }
  return result
}

export async function maaEvalExpr(
  expr: MaaTaskExpr,
  self: string,
  strip: boolean
): Promise<string[] | null> {
  if (!isMaaAssistantArknights) {
    return null
  }

  await taskIndexService.flushDirty()

  const context = new MaaEvalContext(new MaaEvalDelegateImpl())

  return await context.evalExpr(expr, self, strip)
}

function makeUnique(input: string[], keepLast = false): string[] {
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

function removeDupPrefix(segs: string[]) {
  const last = segs.pop()!
  return [...makeUnique(segs, true), last].join('@')
}
