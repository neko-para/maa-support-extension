import type { Node } from 'jsonc-parser'
import * as path from 'path'

import type { IContentLoader } from '../../content/loader'
import { LayerInfo } from '../../layer/layer'
import type { AbsolutePath, RelativePath, TaskName } from '../../utils/types'
import { isString, parseArray, parseObject } from '../utils'
import { parseCtrlRef } from './ctrlRef'
import { locKeys } from './keys'
import { parseLanguage } from './language'
import { parseOption } from './option'
import { parseOptionRef } from './optionRef'
import { parseOverride } from './override'
import { parsePath } from './path'
import { parseResRef } from './resRef'

export type IntLangDeclInfo = {
  type: 'interface.language'
  name: string
  path: string
}

export type IntCtrlDeclInfo = {
  type: 'interface.controller'
  name: string
}

export type IntResDeclInfo = {
  type: 'interface.resource'
  name: string
  paths: RelativePath[]
  controller?: string[]
}

export type IntTaskDeclInfo = {
  type: 'interface.task'
  name: TaskName
}

export type IntOptionDeclInfo = {
  type: 'interface.option'
  name: string
}

export type IntCaseDeclInfo = {
  type: 'interface.case'
  name: string
  option: string
}

export type IntInputDeclInfo = {
  type: 'interface.input'
  name: string
  option: string
  cast?: 'string' | 'int' | 'bool'
}

export type InterfaceDeclInfo = {
  location: Node
} & (
  | IntLangDeclInfo
  | IntCtrlDeclInfo
  | IntResDeclInfo
  | IntTaskDeclInfo
  | IntOptionDeclInfo
  | IntCaseDeclInfo
  | IntInputDeclInfo
)

export type IntLangPathRefInfo = {
  type: 'interface.language_path'
  target: string
}

export type IntLocaleRefInfo = {
  type: 'interface.locale'
  target: string
}

export type IntResPathRefInfo = {
  type: 'interface.resource_path'
  target: RelativePath
}

export type IntCtrlRefInfo = {
  type: 'interface.controller'
  target: string
}

export type IntResRefInfo = {
  type: 'interface.resource'
  target: string
}

export type IntTaskEntryRefInfo = {
  type: 'interface.task_entry'
  target: TaskName
}

export type IntOptionRefInfo = {
  type: 'interface.option'
  target: string
}

export type IntCaseRefInfo = {
  type: 'interface.case'
  target: string
  option: string
}

export type IntInputRefInfo = {
  type: 'interface.input'
  target: string
  option: string
  offset: number
}

export type InterfaceRefInfo = {
  location: Node
} & (
  | IntLangPathRefInfo
  | IntLocaleRefInfo
  | IntResPathRefInfo
  | IntCtrlRefInfo
  | IntResRefInfo
  | IntTaskEntryRefInfo
  | IntOptionRefInfo
  | IntCaseRefInfo
  | IntInputRefInfo
)

export type InterfaceInfo = {
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: LayerInfo
}

export type InterfaceParseContext = {
  maa: boolean
  file: AbsolutePath
}

function parseController(node: Node, info: InterfaceInfo) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          info.decls.push({
            location: obj,
            type: 'interface.controller',
            name: obj.value
          })
        }
        break
    }
  }
}

function parseResource(node: Node, info: InterfaceInfo) {
  let loc: Node | null = null
  const decl: IntResDeclInfo = {
    type: 'interface.resource',
    name: '',
    paths: []
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          loc = obj
          decl.name = obj.value
        }
        break
      case 'path':
        decl.paths = parsePath(obj, info)
        break
      case 'controller':
        decl.controller = parseCtrlRef(obj, info)
        break
      case 'option':
        parseOptionRef(obj, info)
        break
    }
  }
  if (loc) {
    info.decls.push({
      location: loc,
      ...decl
    })
  }
}

function parseTaskSec(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          info.decls.push({
            location: obj,
            type: 'interface.task',
            name: obj.value as TaskName
          })
        }
        break
      case 'entry':
        if (isString(obj)) {
          info.refs.push({
            location: obj,
            type: 'interface.task_entry',
            target: obj.value as TaskName
          })
          info.layer.extraRefs.push({
            file: ctx.file,
            location: obj,
            type: 'task.entry',
            target: obj.value as TaskName
          })
        }
        break
      case 'resource':
        parseResRef(obj, info)
        break
      case 'controller':
        parseCtrlRef(obj, info)
        break
      case 'pipeline_override':
        parseOverride(obj, info, ctx)
        break
      case 'option':
        parseOptionRef(obj, info)
        break
    }
  }
}

function parseLocalization(node: Node, info: InterfaceInfo) {
  if (node.type === 'object') {
    for (const [key, obj] of parseObject(node)) {
      if (locKeys.includes(key) && isString(obj) && obj.value.startsWith('$')) {
        info.refs.push({
          location: obj,
          type: 'interface.locale',
          target: obj.value.substring(1)
        })
      } else {
        parseLocalization(obj, info)
      }
    }
  } else if (node.type === 'array') {
    for (const obj of parseArray(node)) {
      parseLocalization(obj, info)
    }
  }
}

export function parseInterface(loader: IContentLoader, node: Node, ctx: InterfaceParseContext) {
  const info: InterfaceInfo = {
    decls: [],
    refs: [],
    layer: new LayerInfo(loader, ctx.maa, path.dirname(ctx.file) as AbsolutePath, 'interface')
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'languages':
        parseLanguage(obj, info)
        break
      case 'controller':
        for (const sub of parseArray(obj)) {
          parseController(sub, info)
        }
        break
      case 'resource':
        for (const sub of parseArray(obj)) {
          parseResource(sub, info)
        }
        break
      case 'task':
        for (const sub of parseArray(obj)) {
          parseTaskSec(sub, info, ctx)
        }
        break
      case 'option':
        parseOption(obj, info, ctx)
        break
    }
  }

  parseLocalization(node, info)

  return info
}
