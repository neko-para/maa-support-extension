import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as vscode from 'vscode'

import { t } from '@mse/locale'
import {
  AbsolutePath,
  DiagnosticOption,
  buildDiagnosticMessage,
  performDiagnostic
} from '@mse/pipeline-manager'

import { interfaceService } from '.'
import { currentWorkspace } from '../utils/fs'
import { BaseService } from './context'
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

  async doFlushImpl() {
    const intBundle = interfaceService.interfaceBundle
    if (!intBundle) {
      return
    }
    await intBundle.flush(true)

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []
    const diagOption: DiagnosticOption = {}

    const rcPath = vscode.Uri.joinPath(currentWorkspace()!, '.vscode', 'maa_checker.json').fsPath
    if (existsSync(rcPath)) {
      const rc = JSON.parse(await fs.readFile(rcPath, 'utf8'))
      Object.assign(diagOption, rc)
    }

    const diags = performDiagnostic(intBundle, diagOption)
    for (const diag of diags) {
      const [start, end, brief] = await buildDiagnosticMessage(
        currentWorkspace()!.fsPath as AbsolutePath,
        diag,
        async (file, offset) => {
          const doc = await vscode.workspace.openTextDocument(file)
          const pos = doc.positionAt(offset)
          return [pos.line, pos.character]
        },
        diagOption
      )

      const uri = vscode.Uri.file(diag.file)
      result.push([
        uri,
        new vscode.Diagnostic(
          new vscode.Range(
            new vscode.Position(start[0], start[1]),
            new vscode.Position(end[0], end[1])
          ),
          brief,
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
