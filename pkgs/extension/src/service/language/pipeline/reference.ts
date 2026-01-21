import * as vscode from 'vscode'

import { AbsolutePath, TaskMaaTaskRef, findDeclRef, findMaaDeclRef } from '@mse/pipeline-manager'

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
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo
    const topLayer = intBundle.topLayer!

    const offset = document.offsetAt(position)
    const decls = layer.mergedDecls.filter(decl => decl.file === file)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)

    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    const allDecls = topLayer.mergedAllDecls
    const allRefs = topLayer.mergedAllRefs

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
      } else {
        return null
      }
    }

    const resultDecls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
    const resultRefs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
    return await Promise.all([...resultDecls, ...resultRefs].map(autoConvertRangeLocation))
  }
}
