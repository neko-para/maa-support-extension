import * as vscode from 'vscode'

import {
  type InterfaceBundle,
  type LayerInfo,
  type TaskRefInfo,
  findDeclRef
} from '@nekosu/maa-pipeline-manager'
import type { AbsolutePath } from '@nekosu/maa-pipeline-manager'

import { commands } from '../../../command'
import { isMaaAssistantArknights } from '../../../utils/fs'
import { convertRangeWithDelta } from '../utils'
import { PipelineLanguageProvider } from './base'
import { type CustomCompletionItem, provideCompletionItemsLegacy } from './completion-legacy'

type CompleteKind = 'task' | 'anchor' | 'image' | 'locale'

type TaskBriefInfo = { reco?: string; act?: string }

class CompletionSpec {
  kind: CompleteKind
  isStringMode: boolean
  prefixOptions: ('JumpBack' | 'Anchor')[]
  rangeExpandRight: number
  taskFilter?: (info: TaskBriefInfo) => boolean

  constructor(
    kind: CompleteKind,
    isStringMode: boolean,
    prefixOptions: ('JumpBack' | 'Anchor')[],
    rangeExpandRight: number,
    taskFilter?: (info: TaskBriefInfo) => boolean
  ) {
    this.kind = kind
    this.isStringMode = isStringMode
    this.prefixOptions = prefixOptions
    this.rangeExpandRight = rangeExpandRight
    this.taskFilter = taskFilter
  }

  static task() {
    return new CompletionSpec('task', false, [], 1)
  }

  static anchor() {
    return new CompletionSpec('anchor', false, [], 1)
  }

  static taskWithPrefix(offset: number, prefixes: ('JumpBack' | 'Anchor')[]) {
    return new CompletionSpec('task', true, prefixes, 1 + offset)
  }

  static anchorWithPrefix(offset: number) {
    return new CompletionSpec('anchor', true, [], 1 + offset)
  }

  static image() {
    return new CompletionSpec('image', false, [], 1)
  }

  static locale() {
    return new CompletionSpec('locale', false, [], 2)
  }

  withColorMatchFilter() {
    return new CompletionSpec(
      this.kind,
      this.isStringMode,
      [...this.prefixOptions],
      this.rangeExpandRight,
      info => info.reco === 'ColorMatch'
    )
  }
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
  ) {
    if (vscode.workspace.getConfiguration('maa').get<boolean>('pipelineCompletionV2')) {
      return this.provideCompletionItemsV2(document, position, token, context)
    }
    return provideCompletionItemsLegacy.call(this, document, position, token, context)
  }

  async provideCompletionItemsV2(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
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

    if (decl && decl.type === 'task.anchor') {
      const anchorsDeclared = decls
        .filter(d => d.type === 'task.anchor')
        .filter(d2 => (d2 as typeof decl).belong === decl.belong)
        .map(d => (d as typeof decl).anchor)
      const anchors = layer
        .getAnchorList()
        .map(([anchor]) => anchor)
        .filter(anchor => !anchorsDeclared.includes(anchor))
      return [...new Set(anchors)].map(anchor => ({
        label: anchor,
        kind: vscode.CompletionItemKind.Variable,
        range: convertRangeWithDelta(document, decl.location, -1, 1),
        sortText: anchor
      }))
    }

    if (!ref) {
      return null
    }

    if (isMaaAssistantArknights) {
      return provideCompletionItemsLegacy.call(this, document, position, _token, _context)
    }

    const spec = this.resolveCompletionSpec(ref)
    if (!spec) {
      return null
    }

    return this.buildCompletionItems(ref, spec, layer, intBundle, document)
  }

  resolveCompletionSpec(ref: TaskRefInfo) {
    switch (ref.type) {
      case 'task.next':
        if (ref.objMode) {
          return ref.attrs.attrs.Anchor ? CompletionSpec.anchor() : CompletionSpec.task()
        }
        if (ref.attrs.attrs.Anchor) {
          return CompletionSpec.anchorWithPrefix(ref.attrs.offset)
        }
        return CompletionSpec.taskWithPrefix(
          ref.attrs.offset,
          ref.attrs.attrs.JumpBack ? ['Anchor'] : ['JumpBack', 'Anchor']
        )

      case 'task.target':
        return ref.attrs.attrs.Anchor
          ? CompletionSpec.anchorWithPrefix(ref.attrs.offset)
          : CompletionSpec.taskWithPrefix(ref.attrs.offset, ['Anchor'])

      case 'task.roi':
        return ref.attrs.attrs.Anchor
          ? CompletionSpec.anchorWithPrefix(ref.attrs.offset)
          : CompletionSpec.taskWithPrefix(ref.attrs.offset, ['Anchor'])

      case 'task.anchor':
        return CompletionSpec.task()

      case 'task.reco':
        return CompletionSpec.task()

      case 'task.custom_task':
        return CompletionSpec.task()

      case 'task.entry':
        return CompletionSpec.task()

      case 'task.custom_anchor':
        return CompletionSpec.anchor()

      case 'task.color_filter':
        return CompletionSpec.task().withColorMatchFilter()

      case 'task.template':
      case 'task.custom_template':
        return CompletionSpec.image()

      case 'task.locale':
        return CompletionSpec.locale()

      default:
        return null
    }
  }

  buildCompletionItems(
    ref: TaskRefInfo,
    spec: CompletionSpec,
    layer: LayerInfo,
    intBundle: InterfaceBundle,
    document: vscode.TextDocument
  ) {
    // locale 的 item 结构不同（insertText + fillDetail），需要 early return
    if (spec.kind === 'locale') {
      const range = convertRangeWithDelta(document, ref.location, -1, spec.rangeExpandRight)
      return intBundle.langBundle.allKeys().map(name => {
        const esc = JSON.stringify(name)
        return {
          label: name,
          kind: vscode.CompletionItemKind.Constant,
          insertText: esc.substring(1, esc.length - 1),
          range,
          fillDetail: async () => (await this.getLocaleHover(name)) ?? ''
        }
      })
    }

    const items: CustomCompletionItem[] = []

    const range = convertRangeWithDelta(document, ref.location, -1, spec.rangeExpandRight)
    const isSingleChar =
      range.start.line === range.end.line && range.start.character === range.end.character
    const triggerNext: vscode.Command | undefined =
      spec.isStringMode && isSingleChar
        ? { command: commands.TriggerCompletion, title: 'trigger next' }
        : undefined

    for (const prefix of spec.prefixOptions) {
      items.push({
        label: `[${prefix}]`,
        kind: vscode.CompletionItemKind.Property,
        range: new vscode.Range(range.start, range.start),
        sortText: prefix === 'JumpBack' ? '0_JumpBack' : '2_Anchor',
        command: triggerNext
      })
    }

    switch (spec.kind) {
      case 'task':
        for (const task of layer.getTaskList()) {
          if (spec.taskFilter) {
            const info = layer.getTaskBriefInfo(task)
            if (!spec.taskFilter(info)) {
              continue
            }
          }
          items.push({
            label: task,
            kind: vscode.CompletionItemKind.Class,
            range,
            sortText: '1_' + task,
            fillTaskDetail: () => this.getTaskBrief(intBundle, task)
          })
        }
        break

      case 'anchor': {
        const anchors = [...new Set(layer.getAnchorList().map(([a]) => a))]
        if (anchors.length === 0) {
          items.push({
            label: '(no anchors)',
            insertText: '',
            kind: vscode.CompletionItemKind.Variable,
            range: new vscode.Range(range.start, range.start)
          })
        } else {
          for (const anchor of anchors) {
            items.push({
              label: anchor,
              kind: vscode.CompletionItemKind.Variable,
              range,
              sortText: spec.isStringMode ? '1_' + anchor : anchor
            })
          }
        }
        break
      }

      case 'image':
        for (const [folder] of layer.getImageFolders()) {
          items.push({
            label: folder + '/',
            kind: vscode.CompletionItemKind.Folder,
            range,
            sortText: '0_' + folder + '/'
          })
        }
        for (const image of layer.getImageList()) {
          items.push({
            label: image,
            kind: vscode.CompletionItemKind.File,
            range,
            sortText: '1_' + image
          })
        }
        break
    }

    if (ref.type === 'task.roi') {
      for (const subName of ref.prev) {
        items.push({
          label: subName.value,
          kind: vscode.CompletionItemKind.Reference,
          range,
          sortText: '0_' + subName.value
        })
      }
    }

    return items
  }

  async resolveCompletionItem(item: CustomCompletionItem, _token: vscode.CancellationToken) {
    if (item.fillTaskDetail) {
      item.documentation = new vscode.MarkdownString(item.fillTaskDetail())
    }
    return item
  }
}
