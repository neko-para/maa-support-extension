import * as vscode from 'vscode'

import { taskIndexService } from '../..'
import { PipelineLanguageProvider } from './base'

export class PipelineHoverProvider
  extends PipelineLanguageProvider
  implements vscode.HoverProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerHoverProvider(sel, this)
    })
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    await taskIndexService.flushDirty()

    const [info, layer] = await taskIndexService.queryLocation(document.uri, position)

    if (!info || !layer) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      return new vscode.Hover(
        await taskIndexService.queryTaskDoc(info.target, layer.level + 1, position)
      )
    } else if (info.type === 'image.ref') {
      return new vscode.Hover(await taskIndexService.queryImageDoc(info.target))
    }

    return null
  }
}
