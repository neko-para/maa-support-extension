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
      const trigger = isMaaAssistantArknights ? '"@#+^(' : '"[]$'
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
    const decls = layer.mergedDecls.filter(decl => decl.file === file)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    const result: CustomCompletionItem[] = []

    if (decl && decl.type === 'task.anchor') {
      const anchorsDeclared = decls
        .filter(decl => decl.type === 'task.anchor')
        .filter(decl2 => decl2.belong === decl.belong)
        .map(decl => decl.anchor)
      const anchors = layer
        .getAnchorList()
        .map(([anchor]) => anchor)
        .filter(anchor => !anchorsDeclared.includes(anchor))
      for (const anchor of new Set(anchors)) {
        const item: CustomCompletionItem = {
          label: anchor,
          kind: vscode.CompletionItemKind.Variable,
          range: convertRangeWithDelta(document, decl.location, -1, 1),
          sortText: anchor
        }
        result.push(item)
      }
      return result
    }

    if (!ref) {
      return null
    }

    if (isMaaAssistantArknights) {
      if (ref.type !== 'task.maa.base_task' && ref.type !== 'task.maa.expr') {
        return null
      }

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
              fillTaskDetail: () => this.getTaskBrief(intBundle, task, ref.belong)
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
              fillTaskDetail: () => this.getTaskBrief(intBundle, task, ref.belong),
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
      ref.type === 'task.anchor' ||
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
          fillTaskDetail: () => this.getTaskBrief(intBundle, task)
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
      let triggerNext: vscode.Command | undefined = {
        command: commands.TriggerCompletion,
        title: 'trigger next'
      }
      const range = convertRangeWithDelta(document, ref.location, -1, 1 + (ref.offset ?? 0))
      if (range.start.line !== range.end.line || range.start.character !== range.end.character) {
        triggerNext = undefined
      }
      if (!ref.jumpBack) {
        const item: CustomCompletionItem = {
          label: '[JumpBack]',
          kind: vscode.CompletionItemKind.Property,
          range: new vscode.Range(range.start, range.start),
          sortText: '0_JumpBack',
          command: triggerNext
        }
        result.push(item)
      }
      if (!ref.anchor) {
        const item: CustomCompletionItem = {
          label: '[Anchor]',
          kind: vscode.CompletionItemKind.Property,
          range: new vscode.Range(range.start, range.start),
          sortText: '2_Anchor',
          command: triggerNext
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
            fillTaskDetail: () => this.getTaskBrief(intBundle, task)
          }
          result.push(item)
        }
      }
    } else if (ref.type === 'task.template') {
      for (const [imageFolder, layers] of layer.getImageFolders()) {
        const item: CustomCompletionItem = {
          label: imageFolder + '/',
          kind: vscode.CompletionItemKind.Folder,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: '0_' + imageFolder + '/'
        }
        result.push(item)
      }
      for (const image of layer.getImageList()) {
        const item: CustomCompletionItem = {
          label: image,
          kind: vscode.CompletionItemKind.File,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: '1_' + image
        }
        result.push(item)
      }
    } else if (ref.type === 'task.locale') {
      const range = convertRangeWithDelta(document, ref.location, -1, 2)

      const keys = intBundle.langBundle.allKeys()

      return keys.map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Constant,
          insertText: esc.substring(1, esc.length - 1),
          range,
          fillDetail: async () => {
            return (await this.getLocaleHover(name)) ?? ''
          }
        }
      })
    }
    return result
  }

  async resolveCompletionItem(
    item: CustomCompletionItem,
    token: vscode.CancellationToken
  ): Promise<CustomCompletionItem> {
    if (item.fillTaskDetail) {
      item.documentation = new vscode.MarkdownString(item.fillTaskDetail())
    }
    return item
  }
}
