import * as vscode from 'vscode'

import { AbsolutePath, findDeclRef, findMaaDeclRef } from '@mse/pipeline-manager'

import { isMaaAssistantArknights } from '../../../utils/fs'
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
    const [layer, file, isDefault] = layerInfo

    const decls = layer.mergedDecls.filter(decl => decl.file === file)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)

    const offset = document.offsetAt(position)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    if (decl) {
      if (decl.type === 'task.decl') {
        if (isDefault) {
          return null
        }

        const hover = await this.getTaskHover(intBundle, intBundle.topLayer, decl.task)
        return new vscode.Hover(hover)
      }
    } else if (ref) {
      if (isMaaAssistantArknights) {
        if (ref && (ref.type === 'task.maa.base_task' || ref.type === 'task.maa.expr')) {
          const taskRef = findMaaDeclRef(ref.tasks, offset - ref.location.offset)
          if (taskRef) {
            const hover = await this.getTaskHover(
              intBundle,
              intBundle.topLayer,
              taskRef.taskSuffix,
              ref.belong
            )
            return new vscode.Hover(hover)
          } else {
            return null
          }
        }
      }

      if (
        ref.type === 'task.next' ||
        ref.type === 'task.target' ||
        ref.type === 'task.roi' ||
        ref.type === 'task.entry'
      ) {
        if (ref.type === 'task.next' && ref.anchor) {
          return null
        } else if (ref.type === 'task.roi') {
          if (ref.prevRef) {
            return null
          }
        }
        const hover = await this.getTaskHover(intBundle, intBundle.topLayer, ref.target)
        return new vscode.Hover(hover)
      } else if (ref.type === 'task.template') {
        const hover = this.getImageHover(intBundle, intBundle.topLayer, ref.target)
        return new vscode.Hover(hover)
      }
    }
    return null
  }
}
