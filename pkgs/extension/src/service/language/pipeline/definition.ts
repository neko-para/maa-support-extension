import * as vscode from 'vscode'

import { AbsolutePath, TaskMaaTaskRef, findDeclRef, findMaaDeclRef } from '@mse/pipeline-manager'

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
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.DefinitionLink[] | null> {
    const intBundle = await this.flush()
    if (!intBundle) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file, isDefault] = layerInfo
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
      } else {
        return null
      }
    }

    if (decl) {
      if (isDefault && decl.type === 'task.decl') {
        return null
      }

      const decls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      const refs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all([...decls, ...refs].map(autoConvertRangeLocation))
    } else if (ref) {
      const decls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all(decls.map(autoConvertRangeLocation))
    }

    return null
  }
}
