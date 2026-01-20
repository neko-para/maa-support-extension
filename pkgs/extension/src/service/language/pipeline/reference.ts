import * as vscode from 'vscode'

import { AbsolutePath, findDeclRef } from '@mse/pipeline-manager'

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
    if (!intBundle || !intBundle.info?.layer) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo

    const offset = document.offsetAt(position)
    const [decls, refs] = layer.mergeDeclsRefs(file)

    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    const [allDecls, allRefs] = intBundle.info.layer.mergeAllDeclsRefs()

    const resultDecls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
    const resultRefs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
    return await Promise.all([...resultDecls, ...resultRefs].map(autoConvertRangeLocation))

    /*

    if (this.shouldFilter(document)) {
      return null
    }

    await taskIndexService.flushDirty()

    const [info, _] = await taskIndexService.queryLocation(document.uri, position)

    if (!info) {
      return null
    }

    if (info.type === 'task.ref' || info.type === 'task.prop') {
      const result: vscode.Location[] = []
      for (const layer of taskIndexService.layers) {
        for (const [task, taskInfos] of Object.entries(layer.index)) {
          for (const taskInfo of taskInfos) {
            for (const refInfo of taskInfo.taskRef) {
              if (refInfo.task === info.target) {
                result.push(new vscode.Location(taskInfo.uri, refInfo.range))
              }
              if (isMaaAssistantArknights) {
                if (refInfo.task.endsWith('@' + info.target)) {
                  result.push(new vscode.Location(taskInfo.uri, refInfo.range))
                }
              }
            }
            if (isMaaAssistantArknights) {
              if (task.endsWith('@' + info.target)) {
                result.push(new vscode.Location(taskInfo.uri, taskInfo.taskProp))
              }
            }
          }
        }
      }
      return result
    } else if (info.type === 'anchor.def' || info.type === 'anchor.ref') {
      const result: vscode.Location[] = []
      for (const layer of taskIndexService.layers) {
        for (const [task, taskInfos] of Object.entries(layer.index)) {
          for (const taskInfo of taskInfos) {
            for (const anchorRef of taskInfo.anchorRef) {
              if (anchorRef.anchor === info.target) {
                result.push(new vscode.Location(taskInfo.uri, anchorRef.range))
              }
            }
          }
        }
      }
      return result
    }
*/
    return null
  }
}
