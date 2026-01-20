import * as vscode from 'vscode'

import { AbsolutePath, findDeclRef } from '@mse/pipeline-manager'

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
    if (!intBundle || !intBundle.info?.layer) {
      return null
    }

    const layerInfo = intBundle.locateLayer(document.uri.fsPath as AbsolutePath)
    if (!layerInfo) {
      return null
    }
    const [layer, file] = layerInfo

    const offset = document.offsetAt(position)
    const decls = layer.mergedDecls.filter(decl => decl.file === file)
    const refs = layer.mergedRefs.filter(ref => ref.file === file)

    const decl = findDeclRef(decls, offset)
    const ref = findDeclRef(refs, offset)

    const allDecls = intBundle.info.layer.mergedAllDecls
    const allRefs = intBundle.info.layer.mergedAllRefs

    if (decl) {
      const decls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      const refs = this.makeRefs(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all([...decls, ...refs].map(autoConvertRangeLocation))
    } else if (ref) {
      const decls = this.makeDecls(allDecls, allRefs, decl, ref) ?? []
      return await Promise.all(decls.map(autoConvertRangeLocation))
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
      const taskInfo = await taskIndexService.queryTask(
        info.target,
        layer.level + 1,
        undefined // position 这里不传入position, 使得查找定义能够找到所有重复版本
      )
      return taskInfo.map(x => new vscode.Location(x.info.uri, x.info.taskProp))
    } else if (info.type === 'anchor.ref' || info.type === 'anchor.def') {
      const anchorInfo = await taskIndexService.queryAnchor(info.target, layer.level + 1)
      return anchorInfo.map(x => new vscode.Location(x.info.uri, x.info.range))
    }

    */
    return null
  }
}
