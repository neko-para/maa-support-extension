import * as vscode from 'vscode'

import { interfaceService } from '../..'
import { debounce } from '../../utils/debounce'
import { InterfaceLanguageProvider } from './base'

export class InterfaceInlayHintsProvider
  extends InterfaceLanguageProvider
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

    if (intBundle.langBundle.langs.length === 0) {
      return []
    }

    const index = intBundle.info

    const beginOffset = document.offsetAt(range.start)
    const endOffset = document.offsetAt(range.end)
    const refs = index.refs.filter(ref => {
      if (ref.file !== document.uri.fsPath) {
        return false
      }
      if (ref.type !== 'interface.locale') {
        return false
      }
      return (
        ref.location.offset >= beginOffset && ref.location.offset + ref.location.length <= endOffset
      )
    })

    const preferredLocale = interfaceService.interfaceConfigJson.locale
    const preferredIndex = intBundle.langBundle.queryName(preferredLocale)

    return refs
      .map(ref => {
        if (ref.type !== 'interface.locale') {
          return null
        }

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
      .filter((hint): hint is vscode.InlayHint => !!hint)
  }
}
