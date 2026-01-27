import * as path from 'path'
import * as vscode from 'vscode'

import {
  InterfaceDeclInfo,
  InterfaceInfo,
  InterfaceRefInfo,
  isString,
  parseObject
} from '@mse/pipeline-manager'

import { interfaceService, rootService } from '../..'
import { BaseService } from '../../context'

export class InterfaceLanguageProvider extends BaseService {
  provider?: vscode.Disposable

  constructor(setup: (selector: vscode.DocumentFilter) => vscode.Disposable) {
    super()

    this.defer = {
      dispose: () => {
        this.provider?.dispose()
      }
    }

    this.defer = rootService.onActiveResourceChanged(() => {
      if (this.provider) {
        this.provider.dispose()
        this.provider = undefined
      }
      const root = rootService.activeResource
      if (root) {
        this.provider = setup({
          scheme: 'file',
          pattern: new vscode.RelativePattern(root.dirUri, path.basename(root.interfaceUri.fsPath))
        })
      }
    })
  }

  async flush() {
    await interfaceService.interfaceBundle?.flush()
    return interfaceService.interfaceBundle ?? null
  }

  async flushIndex() {
    return (await this.flush())?.info ?? null
  }

  findDecls<Type extends InterfaceDeclInfo['type']>(index: InterfaceInfo, type: Type) {
    return index.decls.filter(decl => decl.type === type) as (InterfaceDeclInfo & { type: Type })[]
  }

  findRefs<Type extends InterfaceRefInfo['type']>(index: InterfaceInfo, type: Type) {
    return index.refs.filter(ref => ref.type === type) as (InterfaceRefInfo & { type: Type })[]
  }

  makeDecls(index: InterfaceInfo, decl: InterfaceDeclInfo | null, ref: InterfaceRefInfo | null) {
    if (decl) {
      if (
        decl.type === 'interface.controller' ||
        decl.type === 'interface.resource' ||
        decl.type === 'interface.option'
      ) {
        const decls = this.findDecls(index, decl.type).filter(decl2 => decl2.name === decl.name)
        return decls
      } else if (decl.type === 'interface.case' || decl.type === 'interface.input') {
        const decls = this.findDecls(index, decl.type).filter(
          decl2 => decl2.name === decl.name && decl2.option === decl.option
        )
        return decls
      }
    } else if (ref) {
      if (
        ref.type === 'interface.controller' ||
        ref.type === 'interface.resource' ||
        ref.type === 'interface.option'
      ) {
        const decls = this.findDecls(index, ref.type).filter(decl => decl.name === ref.target)
        return decls
      } else if (ref.type === 'interface.case' || ref.type === 'interface.input') {
        const decls = this.findDecls(index, ref.type).filter(
          decl => decl.name === ref.target && decl.option === ref.option
        )
        return decls
      }
    }
    return null
  }

  makeRefs(index: InterfaceInfo, decl: InterfaceDeclInfo | null, ref: InterfaceRefInfo | null) {
    if (decl) {
      if (
        decl.type === 'interface.controller' ||
        decl.type === 'interface.resource' ||
        decl.type === 'interface.option'
      ) {
        const refs = this.findRefs(index, decl.type).filter(ref => ref.target === decl.name)
        return refs
      } else if (decl.type === 'interface.case' || decl.type === 'interface.input') {
        const decls = this.findRefs(index, decl.type).filter(
          ref => ref.target === decl.name && ref.option === decl.option
        )
        return decls
      }
    } else if (ref) {
      if (
        ref.type === 'interface.controller' ||
        ref.type === 'interface.resource' ||
        ref.type === 'interface.option'
      ) {
        const decls = this.findRefs(index, ref.type).filter(ref2 => ref2.target === ref.target)
        return decls
      } else if (ref.type === 'interface.case' || ref.type === 'interface.input') {
        const decls = this.findRefs(index, ref.type).filter(
          ref2 => ref2.target === ref.target && ref2.option === ref.option
        )
        return decls
      }
    }
    return null
  }

  async getLocaleHover(target: string) {
    const content: string[] = []
    for (const [idx, loc] of (interfaceService.interfaceBundle?.langs ?? []).entries()) {
      const id = interfaceService.interfaceBundle?.langFiles[idx][0]
      if (!loc.node || !id) {
        continue
      }
      let found = false
      for (const [key, obj, prop] of parseObject(loc.node)) {
        if (key === target && isString(obj)) {
          try {
            const doc = await vscode.workspace.openTextDocument(loc.file)
            const pos = doc.positionAt(obj.offset)
            content.push(
              `| [${id}](${vscode.Uri.file(loc.file)}#L${pos.line + 1}) | ${obj.value} |`
            )
            found = true
          } catch {}
        }
      }
      if (!found) {
        content.push(`| ${id} | <missing> |`)
      }
    }
    if (content.length > 0) {
      return `| locale | value |\n| --- | --- |\n${content.join('\n')}`
    }
    return null
  }
}
