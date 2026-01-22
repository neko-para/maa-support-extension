import * as vscode from 'vscode'

import { AbsolutePath, TaskName, findDeclRef } from '@mse/pipeline-manager'

import { commands } from '../../../command'
import { isMaaAssistantArknights } from '../../../utils/fs'
import { convertRangeWithDelta } from '../utils'
import { PipelineLanguageProvider } from './base'

const virtKeys = [
  'none',
  'self',
  'next',
  'sub',
  'exceeded_next',
  'on_error_next',
  'reduce_other_times'
]

type CustomCompletionItem = vscode.CompletionItem & {
  fillTaskDetail?: () => string
}

export class PipelineCompletionProvider
  extends PipelineLanguageProvider
  implements vscode.CompletionItemProvider<CustomCompletionItem>
{
  constructor() {
    super(sel => {
      const trigger = isMaaAssistantArknights ? '"@#+^(' : '"[]'
      return vscode.languages.registerCompletionItemProvider(sel, this, ...trigger.split(''))
    })
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<CustomCompletionItem[] | null> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo

    const offset = document.offsetAt(position)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)
    const ref = findDeclRef(refs, offset)

    if (!ref) {
      return null
    }

    const result: CustomCompletionItem[] = []

    if (isMaaAssistantArknights) {
      const findTaskWordRange = () => {
        if (/[a-zA-Z0-9_-]/.test(lastChar)) {
          let dlt = 0
          let curr = offset - ref.location.offset - 2
          while (curr >= 0) {
            const next = ref.target[curr]
            if (/[a-zA-Z0-9_-]/.test(next)) {
              curr -= 1
              dlt += 1
            } else {
              break
            }
          }
          return new vscode.Range(document.positionAt(document.offsetAt(position) - dlt), position)
        }
        return null
      }

      const lastChar = ref.target[offset - ref.location.offset - 2]
      if (ref.type === 'task.maa.base_task') {
        if (offset === ref.location.offset + 1 || /[@a-zA-Z0-9_-]/.test(lastChar)) {
          const range = convertRangeWithDelta(
            document,
            ref.location,
            -1,
            offset - ref.location.offset
          )
          const taskRange = findTaskWordRange() ?? range
          for (const task of layer.getTaskList()) {
            const item: CustomCompletionItem = {
              label: task,
              kind: vscode.CompletionItemKind.Class,
              range: taskRange,
              detail: this.getTaskBrief(intBundle, layer, task)
            }
            result.push(item)
          }
        }
      } else if (ref.type === 'task.maa.expr') {
        const range = new vscode.Range(position, position)
        if (offset === ref.location.offset + 1 || /[ @+^(a-zA-Z0-9_-]/.test(lastChar)) {
          const taskRange = findTaskWordRange() ?? range
          for (const task of layer.getTaskList()) {
            const item: CustomCompletionItem = {
              label: task,
              kind: vscode.CompletionItemKind.Class,
              range: taskRange,
              detail: this.getTaskBrief(intBundle, layer, task),
              command: {
                command: commands.TriggerCompletion,
                title: 'trigger next'
              }
            }
            result.push(item)
          }
          if (lastChar !== '@') {
            for (const virt of virtKeys) {
              const item: CustomCompletionItem = {
                label: '#' + virt,
                kind: vscode.CompletionItemKind.EnumMember,
                range
              }
              result.push(item)
            }
          }
        } else if (lastChar === '#') {
          for (const virt of virtKeys) {
            const item: CustomCompletionItem = {
              label: virt,
              kind: vscode.CompletionItemKind.EnumMember,
              range
            }
            result.push(item)
          }
        } else {
          for (const virt of virtKeys) {
            const item: CustomCompletionItem = {
              label: '#' + virt,
              kind: vscode.CompletionItemKind.EnumMember,
              range
            }
            result.push(item)
          }
        }
      }

      return result
    }

    if (
      (ref.type === 'task.next' && ref.objMode && !ref.anchor) ||
      ref.type === 'task.target' ||
      ref.type === 'task.roi' ||
      ref.type === 'task.entry'
    ) {
      const range = convertRangeWithDelta(document, ref.location, -1, 1)
      for (const task of layer.getTaskList()) {
        const item: CustomCompletionItem = {
          label: task,
          kind: vscode.CompletionItemKind.Class,
          range,
          sortText: '1_' + task,
          fillTaskDetail: () => this.getTaskBrief(intBundle, layer, task)
        }
        result.push(item)
      }

      if (ref.type === 'task.roi') {
        for (const subName of ref.prev) {
          const item: CustomCompletionItem = {
            label: subName.value,
            kind: vscode.CompletionItemKind.Reference,
            range,
            sortText: '0_' + subName.value
          }
          result.push(item)
        }
      }
    } else if (ref.type === 'task.next' && ref.objMode && ref.anchor) {
      const anchors = layer.getAnchorList().map(([anchor]) => anchor)
      for (const anchor of new Set(anchors)) {
        const item: CustomCompletionItem = {
          label: anchor,
          kind: vscode.CompletionItemKind.Variable,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: anchor
        }
        result.push(item)
      }
    } else if (ref.type === 'task.next' && !ref.objMode) {
      const range = convertRangeWithDelta(document, ref.location, -1, 1 + (ref.offset ?? 0))
      if (!ref.jumpBack) {
        const item: CustomCompletionItem = {
          label: '[JumpBack]',
          kind: vscode.CompletionItemKind.Property,
          range,
          sortText: '0_JumpBack',
          command: {
            command: commands.TriggerCompletion,
            title: 'trigger next'
          }
        }
        result.push(item)
      }
      if (!ref.anchor) {
        const item: CustomCompletionItem = {
          label: '[Anchor]',
          kind: vscode.CompletionItemKind.Property,
          range,
          sortText: '2_Anchor',
          command: {
            command: commands.TriggerCompletion,
            title: 'trigger next'
          }
        }
        result.push(item)
      }
      if (ref.anchor) {
        const anchors = layer.getAnchorList().map(([anchor]) => anchor)
        for (const anchor of new Set(anchors)) {
          const item: CustomCompletionItem = {
            label: anchor,
            kind: vscode.CompletionItemKind.Variable,
            range,
            sortText: '1_' + anchor
          }
          result.push(item)
        }
      } else {
        for (const task of layer.getTaskList()) {
          const item: CustomCompletionItem = {
            label: task,
            kind: vscode.CompletionItemKind.Class,
            range,
            sortText: '1_' + task,
            fillTaskDetail: () => this.getTaskBrief(intBundle, layer, task)
          }
          result.push(item)
        }
      }
    } else if (ref.type === 'task.template') {
      for (const image of layer.getImageList()) {
        const item: CustomCompletionItem = {
          label: image,
          kind: vscode.CompletionItemKind.File,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: image
        }
        result.push(item)
      }
    }
    return result
  }

  async resolveCompletionItem(
    item: CustomCompletionItem,
    token: vscode.CancellationToken
  ): Promise<CustomCompletionItem> {
    if (item.fillTaskDetail) {
      item.detail = item.fillTaskDetail()
    }
    return item
  }
}
