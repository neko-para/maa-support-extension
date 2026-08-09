import * as vscode from 'vscode'

import { logger } from '@mse/utils'
import { t } from '@nekosu/maa-locale'
import { MaaErrorDelegate, type MaaTaskExpr } from '@nekosu/maa-tasker'

import { MaaEvalMissingIssueCollector } from './evalIssues'

export class MaaErrorDelegateImpl extends MaaErrorDelegate {
  private readonly missingIssues = new MaaEvalMissingIssueCollector()

  reset() {
    this.missingIssues.reset()
  }

  takeMissingIssues() {
    return this.missingIssues.take()
  }

  taskLoopDetected(tasks: string[]): void {
    vscode.window.showErrorMessage(`${t('maa.eval.loop-detected')} ${tasks.join(' -> ')}`)
  }

  exprPropLoopDetected(exprs: string[]): void {
    vscode.window.showErrorMessage(`${t('maa.eval.loop-detected')} ${exprs.join(' -> ')}`)
  }

  cannotFindTask(task: string, prefix: string[]): void {
    this.missingIssues.cannotFindTask(task, prefix)
  }

  warnCannotFindBaseTask(task: string): void {
    this.missingIssues.warnCannotFindBaseTask(task)
  }

  parseExprError(expr: MaaTaskExpr, err: string): void {
    logger.error(`parse expr failed ${expr} error ${err}`)
  }

  exprTooLarge(count: number): void {
    logger.error(`expr too large ${count}`)
  }
}
