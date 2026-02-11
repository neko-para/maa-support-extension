import * as vscode from 'vscode'

import { AbsolutePath } from '@mse/pipeline-manager'

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
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return []
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return []
    }
    const [layer] = layerInfo

    const beginOffset = document.offsetAt(range.start)
    const endOffset = document.offsetAt(range.end)
    const refs = layer.mergedRefs.filter(ref => {
      if (ref.file !== document.uri.fsPath) {
        return false
      }
      if (ref.type !== 'task.locale' && ref.type !== 'task.next') {
        return false
      }
      return (
        ref.location.offset >= beginOffset && ref.location.offset + ref.location.length <= endOffset
      )
    })

    const preferredLocale = interfaceService.interfaceConfigJson.locale
    const preferredIndex = intBundle.langBundle.queryName(preferredLocale)

    const locales = refs
      .filter(ref => ref.type === 'task.locale')
      .map(ref => {
        const result = intBundle.langBundle.queryKey(ref.target)[preferredIndex]
        if (!result) {
          return null
        }

        const hint: vscode.InlayHint = {
          position: document.positionAt(ref.location.offset + ref.location.length),
          label: result.value
        }
        return hint
      })

    // 这里其实可以用layer的getTaskDoc, 但是还是提前filter吧, 大概快一点
    const docDecls = layer.mergedAllDecls.filter(decl => decl.type === 'task.doc')

    const docs = refs
      .filter(ref => ref.type === 'task.next')
      .filter(ref => !ref.anchor)
      .map(ref => {
        let text = docDecls
          .filter(decl => decl.task === ref.target)
          .map(decl => decl.doc)
          .join(' ')

        const hint: vscode.InlayHint = {
          position: document.positionAt(ref.location.offset + ref.location.length),
          label: text
        }
        return hint
      })

    return [...locales, ...docs].filter((hint): hint is vscode.InlayHint => !!hint)
  }
}
