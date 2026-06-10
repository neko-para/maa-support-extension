import * as vscode from 'vscode'

import {
  FileViewUtils,
  Snapshot,
  extractTaskRef,
  findDeclRef,
  findMaaDeclRef
} from '@nekosu/maa-pipeline-manager-vnext'

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
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return null
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return null
    }
    const { file } = located

    const decls = FileViewUtils.allDecls(file)
    const refs = FileViewUtils.allRefs(file)

    const offset = document.offsetAt(position)
    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    if (decl) {
      if (decl.type === 'task.decl') {
        if (file.isDefault) {
          return null
        }

        const hover = await this.getTaskHover(snapshot, file, decl.task)
        return new vscode.Hover(hover)
      } else if (decl.type === 'task.locale') {
        const hover = await this.getLocaleHover(decl.key)
        if (hover) {
          return new vscode.Hover(hover)
        }
        return null
      }
    } else if (ref) {
      if (isMaaAssistantArknights) {
        if (ref && (ref.type === 'task.maa.base_task' || ref.type === 'task.maa.expr')) {
          const taskRef = findMaaDeclRef(ref.tasks, offset - ref.location.offset)
          if (taskRef) {
            const hover = await this.getTaskHover(snapshot, file, taskRef.taskSuffix, ref.belong)
            return new vscode.Hover(hover)
          }
          return null
        }
      }

      const task = extractTaskRef(ref)
      if (task) {
        const hover = await this.getTaskHover(snapshot, file, task)
        return new vscode.Hover(hover)
      } else if (ref.type === 'task.template' || ref.type === 'task.custom_template') {
        const hover = this.getImageHover(snapshot, file, ref.target)
        return new vscode.Hover(hover)
      } else if (ref.type === 'task.locale') {
        const hover = await this.getLocaleHover(ref.target)
        if (hover) {
          return new vscode.Hover(hover)
        }
        return null
      }
    }
    return null
  }
}
