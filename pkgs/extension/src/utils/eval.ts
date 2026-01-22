import * as vscode from 'vscode'

import { TaskName } from '@mse/pipeline-manager'
import { logger, t } from '@mse/utils'
import {
  MaaEvalContext,
  MaaEvalDelegate,
  type MaaTask,
  type MaaTaskExpr,
  type MaaTaskWithTraceInfo
} from '@nekosu/maa-tasker'

import { interfaceService, rootService } from '../service'
import { isMaaAssistantArknights } from './fs'

class MaaEvalDelegateImpl extends MaaEvalDelegate {
  query(task: string): [task: MaaTask, anchor: string][] {
    const intBundle = interfaceService.interfaceBundle
    // await intBundle?.flush()
    const topLayer = intBundle?.topLayer
    if (!topLayer) {
      return []
    }

    const infos = topLayer.getTask(task as TaskName, false)
    infos.reverse() // 内部需要从底层到上层
    return infos.map(({ layer, infos }) => {
      const info = infos[0]
      // 这里硬编码了下逻辑
      const path = rootService.relativeToRoot(layer.root).replaceAll('\\', '/')
      const match = /global\/(.+)\//.exec(path)
      const anchor = match ? match[1] : 'Official'
      return [info.obj as MaaTask, anchor]
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

  await interfaceService.interfaceBundle?.flush(true)

  const context = new MaaEvalContext(new MaaEvalDelegateImpl())

  const result = context.evalTask(task)
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

  await interfaceService.interfaceBundle?.flush(true)

  const context = new MaaEvalContext(new MaaEvalDelegateImpl())

  return context.evalExpr(expr, self, strip)
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
