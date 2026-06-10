import * as vscode from 'vscode'

import { FileViewUtils, Snapshot } from '@nekosu/maa-pipeline-manager-vnext'

import { hsv2rgb } from '../../utils/color'
import { convertRange } from '../utils'
import { PipelineLanguageProvider } from './base'

export class PipelineDocumentColorProvider
  extends PipelineLanguageProvider
  implements vscode.DocumentColorProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerColorProvider(sel, this)
    })
  }

  async provideDocumentColors(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.ColorInformation[]> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return []
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return []
    }

    const refs = FileViewUtils.allRefs(located.file).filter(ref => ref.type === 'task.color')

    const result: vscode.ColorInformation[] = []
    for (const ref of refs) {
      let color = ref.color
      if (ref.method === 'hsv') {
        color = hsv2rgb(color[0], color[1], color[2])
      }
      result.push(
        new vscode.ColorInformation(
          convertRange(document, ref.location),
          new vscode.Color(color[0] / 255, color[1] / 255, color[2] / 255, 1)
        )
      )
    }

    return result
  }

  async provideColorPresentations(
    _color: vscode.Color,
    _context: {
      readonly document: vscode.TextDocument
      readonly range: vscode.Range
    },
    _token: vscode.CancellationToken
  ): Promise<vscode.ColorPresentation[]> {
    return []
  }
}
