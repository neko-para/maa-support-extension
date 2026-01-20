import * as vscode from 'vscode'

import { AbsolutePath, findDeclRef } from '@mse/pipeline-manager'

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
    const intBundle = await this.flush()
    if (!intBundle) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo

    const [decls, refs] = layer.mergeDeclsRefs(file)

    const offset = document.offsetAt(position)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    if (ref) {
      if (
        ref.type === 'task.next' ||
        ref.type === 'task.target' ||
        ref.type === 'task.roi' ||
        ref.type === 'task.entry'
      ) {
        if (ref.type === 'task.next' && ref.anchor) {
          return null
        } else if (ref.type === 'task.roi') {
          const prev = ref.prev.filter(decl => decl.value === ref.target)
          if (prev.length > 0) {
            // TODO: 展示下?
            return null
          }
        }
        const hover = await this.getTaskHover(layer, ref.target)
        return new vscode.Hover(hover)
      } else if (ref.type === 'task.template') {
        const hover = await this.getImageHover(layer, ref.target)
        return new vscode.Hover(hover)
      }
      // TODO: show image for task prop, and for maa
    } else if (decl) {
      if (decl.type === 'task.decl') {
        const hover = await this.getTaskHover(layer, decl.task)
        return new vscode.Hover(hover)
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

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const result = await taskIndexService.queryTaskDoc(info.target, layer.level + 1, position)
      if (isMaaAssistantArknights) {
        const image = await taskIndexService.queryImageDoc(
          info.target + '.png',
          layer.level + 1,
          true
        )
        if (image) {
          result.appendMarkdown('\n\n' + image.value)
        }
      }

      return new vscode.Hover(result)
    } else if (info.type === 'image.ref') {
      return new vscode.Hover(await taskIndexService.queryImageDoc(info.target, layer.level + 1))
    }
*/
    return null
  }
}
