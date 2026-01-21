import * as vscode from 'vscode'

import { AbsolutePath, findDeclRef } from '@mse/pipeline-manager'

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

export class PipelineCompletionProvider
  extends PipelineLanguageProvider
  implements vscode.CompletionItemProvider
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
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem> | null> {
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

    const result: vscode.CompletionItem[] = []

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
            const item: vscode.CompletionItem = {
              label: task,
              kind: vscode.CompletionItemKind.Class,
              range: taskRange,
              detail: this.getTaskBrief(layer, task)
            }
            result.push(item)
          }
        }
      } else if (ref.type === 'task.maa.expr') {
        const range = new vscode.Range(position, position)
        if (offset === ref.location.offset + 1 || /[ @+^(a-zA-Z0-9_-]/.test(lastChar)) {
          const taskRange = findTaskWordRange() ?? range
          for (const task of layer.getTaskList()) {
            const item: vscode.CompletionItem = {
              label: task,
              kind: vscode.CompletionItemKind.Class,
              range: taskRange,
              detail: this.getTaskBrief(layer, task),
              command: {
                command: commands.TriggerCompletion,
                title: 'trigger next'
              }
            }
            result.push(item)
          }
          if (lastChar !== '@') {
            for (const virt of virtKeys) {
              const item: vscode.CompletionItem = {
                label: '#' + virt,
                kind: vscode.CompletionItemKind.EnumMember,
                range
              }
              result.push(item)
            }
          }
        } else if (lastChar === '#') {
          for (const virt of virtKeys) {
            const item: vscode.CompletionItem = {
              label: virt,
              kind: vscode.CompletionItemKind.EnumMember,
              range
            }
            result.push(item)
          }
        } else {
          for (const virt of virtKeys) {
            const item: vscode.CompletionItem = {
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
        const item: vscode.CompletionItem = {
          label: task,
          kind: vscode.CompletionItemKind.Class,
          range,
          sortText: '1_' + task,
          detail: this.getTaskBrief(layer, task)
        }
        result.push(item)
      }

      if (ref.type === 'task.roi') {
        for (const subName of ref.prev) {
          const item: vscode.CompletionItem = {
            label: subName.value,
            kind: vscode.CompletionItemKind.Reference,
            range,
            sortText: '0_' + subName.value
            // TODO: document
          }
          result.push(item)
        }
      }
    } else if (ref.type === 'task.next' && ref.objMode && ref.anchor) {
      for (const [anchor, decl] of layer.getAnchorList()) {
        const item: vscode.CompletionItem = {
          label: anchor,
          kind: vscode.CompletionItemKind.Variable,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: anchor,
          detail: decl.task
        }
        result.push(item)
      }
    } else if (ref.type === 'task.next' && !ref.objMode) {
      const range = convertRangeWithDelta(document, ref.location, -1, 1 + (ref.offset ?? 0))
      if (!ref.jumpBack) {
        const item: vscode.CompletionItem = {
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
        const item: vscode.CompletionItem = {
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
        for (const [anchor, decl] of layer.getAnchorList()) {
          const item: vscode.CompletionItem = {
            label: anchor,
            kind: vscode.CompletionItemKind.Variable,
            range,
            sortText: '1_' + anchor,
            detail: decl.task
          }
          result.push(item)
        }
      } else {
        for (const task of layer.getTaskList()) {
          const item: vscode.CompletionItem = {
            label: task,
            kind: vscode.CompletionItemKind.Class,
            range,
            sortText: '1_' + task,
            detail: this.getTaskBrief(layer, task)
          }
          result.push(item)
        }
      }
    } else if (ref.type === 'task.template') {
      for (const image of layer.getImageList()) {
        const item: vscode.CompletionItem = {
          label: image,
          kind: vscode.CompletionItemKind.File,
          range: convertRangeWithDelta(document, ref.location, -1, 1),
          sortText: image
          // TODO: document
        }
        result.push(item)
      }
    }

    /*

    if (this.shouldFilter(document)) {
      return null
    }

    await taskIndexService.flushDirty()

    const [info, layer] = await taskIndexService.queryLocation(document.uri, position)

    if (!info || !layer) {
      return null
    }

    if (info.type === 'task.ref') {
      const taskList = await taskIndexService.queryTaskList(layer.level + 1)
      const anchorList = await taskIndexService.queryAnchorList(layer.level + 1)

      const result: vscode.CompletionItem[] = []

      if (info.attr) {
        for (const attr of ['JumpBack']) {
          const text = `[${attr}]`
          const esc = JSON.stringify(text)
          result.push({
            label: esc.substring(1, esc.length - 1),
            kind: vscode.CompletionItemKind.Reference,
            insertText: esc.substring(1, esc.length - 1),
            range: new vscode.Range(
              info.range.start.translate(0, 1),
              info.range.end.translate(0, -1)
            ),
            command: {
              command: commands.TriggerCompletion,
              title: 'trigger next'
            }
          } satisfies vscode.CompletionItem)
        }

        {
          const text = `[Anchor]`
          result.push(
            ...(await Promise.all(
              anchorList.map(async anchor => {
                const esc = JSON.stringify(text + anchor)
                return {
                  label: esc.substring(1, esc.length - 1),
                  kind: vscode.CompletionItemKind.Reference,
                  insertText: esc.substring(1, esc.length - 1),
                  range: new vscode.Range(
                    info.range.start.translate(0, 1),
                    info.range.end.translate(0, -1)
                  )
                }
              })
            ))
          )
        }
      }

      result.push(
        ...(await Promise.all(
          taskList.map(async task => {
            const esc = JSON.stringify(task)
            return {
              label: esc.substring(1, esc.length - 1),
              kind: vscode.CompletionItemKind.Reference,
              insertText: esc.substring(1, esc.length - 1),
              range: new vscode.Range(
                info.range.start.translate(0, 1),
                info.range.end.translate(0, -1)
              ),
              documentation: await taskIndexService.queryTaskDoc(task, layer.level + 1, position)
            }
          })
        ))
      )

      return result
    } else if (info.type === 'anchor.ref') {
      const anchorList = await taskIndexService.queryAnchorList(layer.level + 1)

      const result: vscode.CompletionItem[] = []

      const text = `[Anchor]`
      result.push(
        ...(await Promise.all(
          anchorList.map(async anchor => {
            const esc = JSON.stringify(text + anchor)
            return {
              label: esc.substring(1, esc.length - 1),
              kind: vscode.CompletionItemKind.Reference,
              insertText: esc.substring(1, esc.length - 1),
              range: new vscode.Range(
                info.range.start.translate(0, 1),
                info.range.end.translate(0, -1)
              )
            }
          })
        ))
      )

      return result
    } else if (info.type === 'task.ref.maa.#') {
      return ['self', 'back', 'sub', 'next'].map(key => {
        return {
          label: key,
          kind: vscode.CompletionItemKind.Constant,
          insertText: key,
          range: new vscode.Range(info.range.start, info.range.end)
        }
      })
    } else if (info.type === 'task.ref.maa.@') {
      const taskList = (await taskIndexService.queryTaskList(layer.level + 1)).filter(
        x => !/@/.test(x)
      )

      return taskList.map(task => {
        return {
          label: task,
          kind: vscode.CompletionItemKind.Reference,
          insertText: task,
          range: new vscode.Range(info.range.start, info.range.end)
        }
      })
    } else if (info.type === 'image.ref') {
      const imageList = await taskIndexService.queryImageList(layer.level + 1)

      return await Promise.all(
        imageList.map(async path => {
          const esc = JSON.stringify(path)
          return {
            label: esc,
            kind: vscode.CompletionItemKind.File,
            insertText: esc.substring(0, esc.length - 1),
            range: new vscode.Range(info.range.start, info.range.end.translate(0, -1)),
            documentation: await taskIndexService.queryImageDoc(path, layer.level + 1)
          }
        })
      )
    }

    */

    return result
  }
}
