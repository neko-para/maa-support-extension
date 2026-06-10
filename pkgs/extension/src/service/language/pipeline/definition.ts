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

export class PipelineDefinitionProvider
  extends PipelineLanguageProvider
  implements vscode.DefinitionProvider
{
  constructor() {
    super(sel => {
      return vscode.languages.registerDefinitionProvider(sel, this)
    })
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
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
      let addRef = false
      if (decl && decl.type === 'task.decl') {
        taskRef = findMaaDeclRef(decl.tasks, offset - decl.location.offset)
        addRef = true
      } else if (ref && (ref.type === 'task.maa.base_task' || ref.type === 'task.maa.expr')) {
        taskRef = findMaaDeclRef(ref.tasks, offset - ref.location.offset)
      }
      if (taskRef) {
        const result = await this.makeMaaDecls(allDecls, taskRef.task)
        if (addRef) {
          result.push(...(await this.makeMaaRefs(allRefs, taskRef.task)))
        }
        if (taskRef.taskSuffix !== taskRef.task) {
          result.push(...(await this.makeMaaDecls(allDecls, taskRef.taskSuffix)))
          if (addRef) {
            result.push(...(await this.makeMaaRefs(allRefs, taskRef.taskSuffix)))
          }
        }
        return result
      }
      return null
    }

    if (decl) {
      if (file.isDefault && decl.type === 'task.decl') {
        return null
      }

      const resultDecls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      const resultRefs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all([...resultDecls, ...resultRefs].map(autoConvertRangeLocation))
    } else if (ref) {
      const resultDecls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all(resultDecls.map(autoConvertRangeLocation))
    }

    return null
  }
}
