import * as vscode from 'vscode'

import { AbsolutePath } from '@mse/pipeline-manager'

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
    token: vscode.CancellationToken
  ): Promise<vscode.ColorInformation[]> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return []
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return []
    }
    const [layer, file] = layerInfo

    const refs = layer.mergedRefs
      .filter(ref => ref.file === file)
      .filter(ref => ref.type === 'task.color')

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
    color: vscode.Color,
    context: {
      readonly document: vscode.TextDocument
      readonly range: vscode.Range
    },
    token: vscode.CancellationToken
  ): Promise<vscode.ColorPresentation[]> {
    return []
  }
}
