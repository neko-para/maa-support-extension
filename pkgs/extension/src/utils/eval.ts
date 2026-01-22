import * as vscode from 'vscode'

import { logger, t } from '@mse/utils'
import { MaaErrorDelegate, type MaaTaskExpr } from '@nekosu/maa-tasker'

export class MaaErrorDelegateImpl extends MaaErrorDelegate {
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
    // vscode.window.showWarningMessage(t('maa.eval.cannot-find-task-base', task))
  }

  parseExprError(expr: MaaTaskExpr, err: string): void {
    logger.error(`parse expr failed ${expr} error ${err}`)
  }

  exprTooLarge(count: number): void {
    logger.error(`expr too large ${count}`)
  }
}
