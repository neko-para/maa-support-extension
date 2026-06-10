import * as vscode from 'vscode'

import { FileViewUtils, Snapshot, extractTaskRef } from '@nekosu/maa-pipeline-manager-vnext'

import { interfaceService } from '../..'
import { debounce } from '../../utils/debounce'
import { PipelineLanguageProvider } from './base'

export class PipelineInlayHintsProvider
  extends PipelineLanguageProvider
  implements vscode.InlayHintsProvider
{
  didChangeInlayHints = new vscode.EventEmitter<void>()
  get onDidChangeInlayHints() {
    return this.didChangeInlayHints.event
  }

  fireChangeInlayHints: () => void

  constructor() {
    super(sel => {
      return vscode.languages.registerInlayHintsProvider(sel, this)
    })

    this.defer = this.didChangeInlayHints

    this.fireChangeInlayHints = debounce(() => {
      this.didChangeInlayHints.fire()
    }, 50)

    this.defer = interfaceService.onInterfaceChanged(() => {
      this.fireChangeInlayHints()
    })
    this.defer = interfaceService.onInterfaceConfigChanged(() => {
      this.fireChangeInlayHints()
    })
    this.defer = interfaceService.onLocaleChanged(() => {
      this.fireChangeInlayHints()
    })
  }

  async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    _token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return []
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return []
    }
    const { file } = located

    const beginOffset = document.offsetAt(range.start)
    const endOffset = document.offsetAt(range.end)
    const refs = FileViewUtils.allRefs(file).filter(
      ref =>
        ref.location.offset >= beginOffset &&
        ref.location.offset + ref.location.length <= endOffset
    )

    const preferredLocale = interfaceService.interfaceConfigJson.__locale
    const preferredIndex = Snapshot.queryLocaleIndex(snapshot, preferredLocale)

    const locales = refs
      .filter(ref => ref.type === 'task.locale')
      .map(ref => {
        const result = Snapshot.queryLocale(snapshot, ref.target)[preferredIndex]
        if (!result) {
          return null
        }

        const hint: vscode.InlayHint = {
          position: document.positionAt(ref.location.offset + ref.location.length),
          label: result.value
        }
        return hint
      })

    const docs = refs.map(ref => {
      const task = extractTaskRef(ref)
      if (!task) {
        return null
      }

      const text = Snapshot.getTaskDoc(snapshot, task)
      if (!text) {
        return null
      }

      const hint: vscode.InlayHint = {
        position: document.positionAt(ref.location.offset + ref.location.length),
        label: text
      }
      return hint
    })

    return [...locales, ...docs].filter((hint): hint is vscode.InlayHint => !!hint)
  }
}
