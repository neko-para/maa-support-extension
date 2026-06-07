import * as path from 'node:path'
import * as vscode from 'vscode'

import {
  type InterfaceDeclInfo,
  type InterfaceInfo,
  type InterfaceRefInfo,
  findInterfaceMatchingDecls,
  findInterfaceMatchingRefs,
  joinPath
} from '@nekosu/maa-pipeline-manager'

import { interfaceService, rootService } from '../..'
import { BaseService } from '../../context'

export class InterfaceLanguageProvider extends BaseService {
  provider?: vscode.Disposable

  constructor(setup: (selector: vscode.DocumentFilter[]) => vscode.Disposable) {
    super()

    this.defer = {
      dispose: () => {
        this.provider?.dispose()
      }
    }

    const updateProvider = () => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const filters: vscode.DocumentFilter[] = []
      const root = rootService.activeResource
      if (root) {
        filters.push({
          scheme: 'file',
          pattern: new vscode.RelativePattern(root.dirUri, path.basename(root.interfaceUri.fsPath))
        })
        for (const imp of interfaceService.interfaceBundle?.importFiles ?? []) {
          filters.push({
            scheme: 'file',
            pattern: new vscode.RelativePattern(root.dirUri, imp)
          })
        }
      }
      this.provider = setup(filters)
    }

    this.defer = rootService.onActiveResourceChanged(updateProvider)
    this.defer = interfaceService.onInterfaceImportChanged(updateProvider)
  }

  async flush() {
    await interfaceService.interfaceBundle?.flush()
    return interfaceService.interfaceBundle ?? null
  }

  async flushIndex() {
    return (await this.flush())?.info ?? null
  }

  makeDecls(index: InterfaceInfo, decl: InterfaceDeclInfo | null, ref: InterfaceRefInfo | null) {
    return findInterfaceMatchingDecls(index, decl, ref)
  }

  makeRefs(index: InterfaceInfo, decl: InterfaceDeclInfo | null, ref: InterfaceRefInfo | null) {
    return findInterfaceMatchingRefs(index, decl, ref)
  }

  async getLocaleHover(target: string) {
    const intBundle = interfaceService.interfaceBundle
    if (!intBundle) {
      return null
    }

    if (intBundle.langBundle.langs.length === 0) {
      return null
    }

    const result = intBundle.langBundle.queryKey(target)

    const content: string[] = []
    for (const [index, entry] of result.entries()) {
      const lang = intBundle.langBundle.langs[index]
      if (entry) {
        const full = joinPath(intBundle.root, lang.file)
        const doc = await vscode.workspace.openTextDocument(full)
        const pos = doc.positionAt(entry.keyNode.offset)
        content.push(
          `| [${lang.name}](${vscode.Uri.file(full)}#L${pos.line + 1}) | ${entry.value} |`
        )
      } else {
        content.push(`| ${lang.name} | <missing> |`)
      }
    }

    if (content.length > 0) {
      return `| locale | value |\n| --- | --- |\n${content.join('\n')}`
    }
    return null
  }
}
