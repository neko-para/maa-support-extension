import * as vscode from 'vscode'

import {
  AnchorName,
  Diagnostic,
  ImageRelativePath,
  TaskName,
  TaskRefInfo,
  extractTaskRef,
  performDiagnostic
} from '@mse/pipeline-manager'
import { t } from '@mse/utils'

import { interfaceService, rootService } from '.'
import { isMaaAssistantArknights } from '../utils/fs'
import { BaseService } from './context'
import { autoBuildRange, autoConvertRange, convertRange } from './language/utils'
import { debounce } from './utils/debounce'
import { FlushHelper } from './utils/flush'

class DiagnosticScanner extends FlushHelper {
  diagnostic: vscode.DiagnosticCollection
  currentDiagnosticUris: vscode.Uri[] = []

  scheduleFlush: () => void

  constructor() {
    super()

    this.diagnostic = vscode.languages.createDiagnosticCollection('maa')

    this.scheduleFlush = debounce(() => {
      this.flushDirty()
    }, 1000)

    setInterval(() => {
      this.flushDirty()
    }, 60000)

    // 启动之后刷一次
    setTimeout(() => {
      this.flushDirty()
    }, 5000)
  }

  buildDiagMessage(diag: Diagnostic) {
    switch (diag.type) {
      case 'conflict-task':
        return t(
          'maa.pipeline.error.conflict-task',
          diag.task,
          rootService.relativeToRoot(diag.previous.file)
        )
      case 'duplicate-next':
        return t('maa.pipeline.error.duplicate-next', diag.task)
      case 'unknown-task':
        return t('maa.pipeline.error.unknown-task', diag.task)
      case 'dynamic-image':
        return t('maa.pipeline.warning.image-path-dynamic')
      case 'image-path-back-slash':
        return t('maa.pipeline.warning.image-path-backslash')
      case 'image-path-dot-slash':
        return t('maa.pipeline.warning.image-path-dot-slash')
      case 'image-path-missing-png':
        return t('maa.pipeline.warning.image-path-missing-png')
      case 'unknown-image':
        return t('maa.pipeline.error.unknown-image', diag.image)
      case 'unknown-anchor':
        return t('maa.pipeline.error.unknown-anchor', diag.anchor)
      case 'unknown-attr':
        return t('maa.pipeline.error.unknown-attr', diag.attr)
      case 'int-conflict-option':
        return t(
          'maa.pipeline.error.conflict-option',
          diag.option,
          rootService.relativeToRoot(diag.previous.file)
        )
      case 'int-unknown-option':
        return t('maa.pipeline.error.unknown-option', diag.option)
      case 'int-unknown-entry-task':
        return t('maa.pipeline.error.unknown-entry-task', diag.task)
      case 'int-override-unknown-task':
        return t('maa.pipeline.error.override-unknown-task', diag.task)
    }
    return `unknown diagnostic: ${JSON.stringify(diag)}`
  }

  async doFlushImpl() {
    const intBundle = interfaceService.interfaceBundle
    if (!intBundle) {
      return
    }
    await intBundle.flush(true)

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []

    const diags = performDiagnostic(intBundle)
    for (const diag of diags) {
      const uri = vscode.Uri.file(diag.file)
      const range = await autoBuildRange(diag.offset, diag.length, diag.file)
      result.push([
        uri,
        new vscode.Diagnostic(
          range,
          this.buildDiagMessage(diag),
          diag.level === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Error
        )
      ])
    }

    if (result.length === 0) {
      this.diagnostic.clear()
      this.currentDiagnosticUris = []
    } else {
      const nextDiagUris: vscode.Uri[] = []
      const diagResult: [vscode.Uri, vscode.Diagnostic[]][] = []
      for (const [uri, diag] of result) {
        if (!nextDiagUris.find(x => x.fsPath === uri.fsPath)) {
          nextDiagUris.push(uri)
          diagResult.push([uri, [diag]])
        } else {
          diagResult.find(x => x[0].fsPath === uri.fsPath)?.[1].push(diag)
        }
      }
      const needClear = this.currentDiagnosticUris.filter(
        x => !nextDiagUris.find(y => y.fsPath === x.fsPath)
      )
      diagResult.push(...needClear.map(x => [x, []] as [vscode.Uri, vscode.Diagnostic[]]))
      this.currentDiagnosticUris = nextDiagUris

      this.diagnostic.set(diagResult)
    }
  }

  async doFlush() {
    await vscode.window.withProgress(
      {
        title: t('maa.status.checking-task'),
        location: vscode.ProgressLocation.Window
      },
      async () => {
        await this.doFlushImpl()
      }
    )
  }
}

export class DiagnosticService extends BaseService {
  scanner: DiagnosticScanner

  constructor() {
    super()
    console.log('construct DiagnosticService')

    this.scanner = new DiagnosticScanner()
  }

  async init() {
    console.log('init DiagnosticService')
  }
}
