import * as path from 'node:path'
import * as vscode from 'vscode'

import {
  type InterfaceDeclInFile,
  type InterfaceRefInFile,
  Snapshot,
  nodePathUtils
} from '@nekosu/maa-pipeline-manager-vnext'
import type { ResourceSnapshot } from '@nekosu/maa-pipeline-manager-vnext'

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
        const snapshot = interfaceService.getSnapshot()
        const importPaths =
          snapshot?.interfaceData?.import?.map(imp =>
            nodePathUtils.join(root.dirUri.fsPath, imp as string)
          ) ?? []
        for (const imp of importPaths) {
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

  async flush(): Promise<ResourceSnapshot | null> {
    return interfaceService.getSnapshot()
  }

  findDecls<Type extends InterfaceDeclInFile['type']>(snapshot: ResourceSnapshot, type: Type) {
    return Snapshot.allInterfaceDecls(snapshot).filter(
      decl => decl.type === type
    ) as (InterfaceDeclInFile & { type: Type })[]
  }

  findRefs<Type extends InterfaceRefInFile['type']>(snapshot: ResourceSnapshot, type: Type) {
    return Snapshot.allInterfaceRefs(snapshot).filter(
      ref => ref.type === type
    ) as (InterfaceRefInFile & { type: Type })[]
  }

  makeDecls(
    snapshot: ResourceSnapshot,
    decl: InterfaceDeclInFile | null,
    ref: InterfaceRefInFile | null
  ) {
    if (decl) {
      if (
        decl.type === 'interface.controller' ||
        decl.type === 'interface.resource' ||
        decl.type === 'interface.group' ||
        decl.type === 'interface.task' ||
        decl.type === 'interface.option'
      ) {
        return this.findDecls(snapshot, decl.type).filter(decl2 => decl2.name === decl.name)
      } else if (decl.type === 'interface.case' || decl.type === 'interface.input') {
        return this.findDecls(snapshot, decl.type).filter(
          decl2 => decl2.name === decl.name && decl2.option === decl.option
        )
      }
    } else if (ref) {
      if (
        ref.type === 'interface.controller' ||
        ref.type === 'interface.resource' ||
        ref.type === 'interface.group' ||
        ref.type === 'interface.task' ||
        ref.type === 'interface.option'
      ) {
        return this.findDecls(snapshot, ref.type).filter(decl => decl.name === ref.target)
      } else if (ref.type === 'interface.case' || ref.type === 'interface.input') {
        return this.findDecls(snapshot, ref.type).filter(
          decl => decl.name === ref.target && decl.option === ref.option
        )
      }
    }
    return null
  }

  makeRefs(
    snapshot: ResourceSnapshot,
    decl: InterfaceDeclInFile | null,
    ref: InterfaceRefInFile | null
  ) {
    if (decl) {
      if (
        decl.type === 'interface.controller' ||
        decl.type === 'interface.resource' ||
        decl.type === 'interface.group' ||
        decl.type === 'interface.task' ||
        decl.type === 'interface.option'
      ) {
        return this.findRefs(snapshot, decl.type).filter(ref => ref.target === decl.name)
      } else if (decl.type === 'interface.case' || decl.type === 'interface.input') {
        return this.findRefs(snapshot, decl.type).filter(
          ref => ref.target === decl.name && ref.option === decl.option
        )
      }
    } else if (ref) {
      if (
        ref.type === 'interface.controller' ||
        ref.type === 'interface.resource' ||
        ref.type === 'interface.group' ||
        ref.type === 'interface.task' ||
        ref.type === 'interface.option'
      ) {
        return this.findRefs(snapshot, ref.type).filter(ref2 => ref2.target === ref.target)
      } else if (ref.type === 'interface.case' || ref.type === 'interface.input') {
        return this.findRefs(snapshot, ref.type).filter(
          ref2 => ref2.target === ref.target && ref2.option === ref.option
        )
      }
    }
    return null
  }

  async getLocaleHover(target: string) {
    const snapshot = interfaceService.getSnapshot()
    if (!snapshot) {
      return null
    }

    if (snapshot.languages.length === 0) {
      return null
    }

    const result = Snapshot.queryLocale(snapshot, target)

    const content: string[] = []
    for (const [index, lang] of snapshot.languages.entries()) {
      const entry = result[index]
      if (entry) {
        const doc = await vscode.workspace.openTextDocument(lang.file)
        const pos = doc.positionAt(entry.keyOffset)
        content.push(
          `| [${lang.name}](${vscode.Uri.file(lang.file)}#L${pos.line + 1}) | ${entry.value} |`
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
