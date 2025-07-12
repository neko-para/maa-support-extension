import * as vscode from 'vscode'

import { t } from '@mse/utils'

import { rootService, taskIndexService } from '.'
import { isMaaAssistantArknights } from '../utils/fs'
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
    await taskIndexService.flushDirty()

    const result: [uri: vscode.Uri, diag: vscode.Diagnostic][] = []

    if (isMaaAssistantArknights) {
      // MAA的template支持后缀搜索，先构建个索引，不然太慢了
      await taskIndexService.flushImage()
    }

    for (const layer of taskIndexService.allLayers) {
      for (const [task, taskInfos] of Object.entries(layer.index)) {
        // check conflict task
        if (taskInfos.length > 1 && layer !== taskIndexService.interfaceLayer) {
          // interface layer contains same override
          for (const taskInfo of taskInfos.slice(1)) {
            result.push([
              taskInfo.uri,
              new vscode.Diagnostic(
                taskInfo.taskProp,
                t(
                  'maa.pipeline.error.conflict-task',
                  task,
                  rootService.relativePathToRoot(taskInfos[0].uri)
                ),
                vscode.DiagnosticSeverity.Error
              )
            ])
          }
        }

        for (const taskInfo of taskInfos) {
          // check missing task
          for (const ref of taskInfo.taskRef) {
            if (ref.task.startsWith('__VSCE__')) {
              continue
            }
            const taskRes = await taskIndexService.queryTask(
              ref.task,
              layer.level + 1,
              undefined,
              false
            )
            if (taskRes.length === 0) {
              result.push([
                taskInfo.uri,
                new vscode.Diagnostic(
                  ref.range,
                  t('maa.pipeline.error.unknown-task', ref.task),
                  vscode.DiagnosticSeverity.Error
                )
              ])
            }
          }

          // check missing image
          for (const ref of taskInfo.imageRef) {
            let imagePath = ref.path
            if (imagePath.includes('\\')) {
              result.push([
                taskInfo.uri,
                new vscode.Diagnostic(
                  ref.range,
                  '图片路径中包含反斜杠, 应使用正斜杠',
                  vscode.DiagnosticSeverity.Warning
                )
              ])
              imagePath = imagePath.replaceAll('\\', '/')
            }
            if (isMaaAssistantArknights && !imagePath.endsWith('.png')) {
              result.push([
                taskInfo.uri,
                new vscode.Diagnostic(
                  ref.range,
                  '图片不应省略.png',
                  vscode.DiagnosticSeverity.Warning
                )
              ])
            }
            const imageRes = await taskIndexService.queryImage(imagePath, layer.level + 1, false)
            if (imageRes.length === 0) {
              result.push([
                taskInfo.uri,
                new vscode.Diagnostic(
                  ref.range,
                  t('maa.pipeline.error.unknown-image', ref.path),
                  vscode.DiagnosticSeverity.Error
                )
              ])
            }
          }

          // check duplicate next task
          if (!isMaaAssistantArknights) {
            const nextRefs = taskInfo.taskRef.filter(x => x.belong === 'next')
            const nextFirst: Set<string> = new Set()
            for (const ref of nextRefs) {
              if (nextFirst.has(ref.task)) {
                result.push([
                  taskInfo.uri,
                  new vscode.Diagnostic(
                    ref.range,
                    t('maa.pipeline.error.duplicate-next', ref.task),
                    vscode.DiagnosticSeverity.Error
                  )
                ])
              } else {
                nextFirst.add(ref.task)
              }
            }
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 0))
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
        title: 'MaaSupport 检查任务中',
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
