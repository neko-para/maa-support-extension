import * as vscode from 'vscode'

import {
  FileViewUtils,
  Snapshot,
  type TaskMaaTaskRef,
  findDeclRef,
  findMaaDeclRef
} from '@nekosu/maa-pipeline-manager-vnext'

import { isMaaAssistantArknights } from '../../../utils/fs'
import { autoConvertRangeLocation } from '../utils'
import { PipelineLanguageProvider } from './base'

export class PipelineReferenceProvider
  extends PipelineLanguageProvider
  implements vscode.ReferenceProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerReferenceProvider(sel, this)
    })
  }

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    const snapshot = await this.flush()
    if (!snapshot) {
      return null
    }

    const located = Snapshot.locateBundle(snapshot, document.uri.fsPath)
    if (!located) {
      return null
    }
    const { file } = located

    const offset = document.offsetAt(position)
    const decls = FileViewUtils.allDecls(file)
    const refs = FileViewUtils.allRefs(file)

    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    const allDecls = Snapshot.allDecls(snapshot)
    const allRefs = Snapshot.allRefs(snapshot)

    if (isMaaAssistantArknights) {
      let taskRef: TaskMaaTaskRef | null = null
      if (decl && decl.type === 'task.decl') {
        taskRef = findMaaDeclRef(decl.tasks, offset - decl.location.offset)
      } else if (ref && (ref.type === 'task.maa.base_task' || ref.type === 'task.maa.expr')) {
        taskRef = findMaaDeclRef(ref.tasks, offset - ref.location.offset)
      }
      if (taskRef) {
        const result = await this.makeMaaDecls(allDecls, taskRef.task)
        result.push(...(await this.makeMaaRefs(allRefs, taskRef.task)))
        if (taskRef.taskSuffix !== taskRef.task) {
          result.push(...(await this.makeMaaDecls(allDecls, taskRef.taskSuffix)))
          result.push(...(await this.makeMaaRefs(allRefs, taskRef.taskSuffix)))
        }
        return result
      }
      return null
    }

    if (file.isDefault && decl?.type === 'task.decl') {
      return null
    }

    const resultDecls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
    const resultRefs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
    return await Promise.all([...resultDecls, ...resultRefs].map(autoConvertRangeLocation))
  }
}
