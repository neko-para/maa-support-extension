import * as vscode from 'vscode'

import {
  AnchorName,
  ImageRelativePath,
  TaskName,
  TaskRefInfo,
  extractTaskRef
} from '@mse/pipeline-manager'
import { t } from '@mse/utils'

import { interfaceService, rootService } from '.'
import { BaseService } from './context'
import { autoConvertRange } from './language/utils'
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
    if (!intBundle?.info?.layer) {
      return
    }
    await intBundle.flush(true)

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []

    for (const layer of intBundle.allLayers) {
      for (const [name, taskInfos] of Object.entries(layer.tasks)) {
        if (taskInfos.length > 0 && layer.type !== 'interface') {
          for (const taskInfo of taskInfos.slice(1)) {
            result.push([
              vscode.Uri.file(taskInfo.file),
              new vscode.Diagnostic(
                await autoConvertRange(taskInfo.prop, taskInfo.file),
                t(
                  'maa.pipeline.error.conflict-task',
                  name,
                  rootService.relativeToRoot(taskInfos[0].file)
                ),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }

        for (const taskInfo of taskInfos) {
          const uri = vscode.Uri.file(taskInfo.file)
          const existsNext = new Set<TaskName>()
          const refs = taskInfo.info.refs.filter(
            ref => ref.type === 'task.next' && !ref.anchor
          ) as (TaskRefInfo & {
            type: 'task.next'
          })[]
          refs.sort((a, b) => a.location.offset - b.location.offset)
          for (const ref of refs) {
            const loc = await autoConvertRange(ref.location, ref.file)
            if (existsNext.has(ref.target)) {
              result.push([
                uri,
                new vscode.Diagnostic(
                  loc,
                  t('maa.pipeline.error.duplicate-next', ref.target),
                  vscode.DiagnosticSeverity.Error
                )
              ])
            } else {
              existsNext.add(ref.target)
            }
          }
        }
      }

      const refs = layer.mergedRefs
      const tasks = new Set(layer.getTaskListNotUnique())
      const anchors = new Set(layer.getAnchorList().map(([anchor]) => anchor))
      const images = new Set(layer.getImageListNotUnique())
      for (const ref of refs) {
        const uri = vscode.Uri.file(ref.file)
        const loc = await autoConvertRange(ref.location, ref.file)
        const task = extractTaskRef(ref)
        if (task) {
          if (!tasks.has(task)) {
            result.push([
              uri,
              new vscode.Diagnostic(
                loc,
                t('maa.pipeline.error.unknown-task', ref.target),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        } else if (ref.type === 'task.template') {
          let imagePath = ref.target
          if (!imagePath.endsWith('.png')) {
            result.push([
              uri,
              new vscode.Diagnostic(
                loc,
                t('maa.pipeline.warning.image-path-dynamic'),
                vscode.DiagnosticSeverity.Warning
              )
            ])
            continue
          }
          if (imagePath.includes('\\')) {
            result.push([
              uri,
              new vscode.Diagnostic(
                loc,
                t('maa.pipeline.warning.image-path-backslash'),
                vscode.DiagnosticSeverity.Warning
              )
            ])
            imagePath = imagePath.replaceAll('\\', '/') as ImageRelativePath
          }
          if (imagePath.startsWith('./')) {
            imagePath = imagePath.replace('./', '') as ImageRelativePath
          }
          // TODO: maa logic
          if (!images.has(imagePath)) {
            result.push([
              uri,
              new vscode.Diagnostic(
                loc,
                t('maa.pipeline.error.unknown-image', ref.target),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        } else if (ref.type === 'task.next' && ref.anchor) {
          if (!anchors.has(ref.target as string as AnchorName)) {
            result.push([
              uri,
              new vscode.Diagnostic(
                loc,
                t('maa.pipeline.error.unknown-anchor', ref.target),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }
      }
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
