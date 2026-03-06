import type { Node } from 'jsonc-parser'

import { LayerInfo } from '../../layer/layer'
import type { OptionTrace } from '../../logic'
import type { AbsolutePath, RelativePath, TaskName } from '../../utils/types'
import { isString, parseArray, parseObject } from '../utils'
import { parseCtrlRef } from './ctrlRef'
import { parseImport } from './import'
import { locKeys } from './keys'
import { parseLanguage } from './language'
import { parseOption } from './option'
import { parseOptionRef } from './optionRef'
import { parseOverride } from './override'
import { parsePath } from './path'
import { parsePreset } from './preset'
import { parseResRef } from './resRef'

export type IntLangDeclInfo = {
  type: 'interface.language'
  name: string
  path: string
}

export type IntCtrlDeclInfo = {
  type: 'interface.controller'
  name: string
  attachs: RelativePath[]
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

export type IntOptionType = 'select' | 'checkbox' | 'switch' | 'input'

export type IntOptionDeclInfo = {
  type: 'interface.option'
  name: string
  optionType?: IntOptionType
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

export type IntPresetDeclInfo = {
  type: 'interface.preset'
  name: string
}

export type InterfaceDeclInfo = {
  file: AbsolutePath
  location: Node
} & (
  | IntLangDeclInfo
  | IntCtrlDeclInfo
  | IntResDeclInfo
  | IntTaskDeclInfo
  | IntOptionDeclInfo
  | IntCaseDeclInfo
  | IntInputDeclInfo
  | IntPresetDeclInfo
)

export type IntLangPathRefInfo = {
  type: 'interface.language_path'
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

export type IntTaskRefInfo = {
  type: 'interface.task'
  target: string
}

export type IntTaskEntryRefInfo = {
  type: 'interface.task_entry'
  target: TaskName
  task: string
}

export type IntOptionRefInfo = {
  type: 'interface.option'
  target: string
  trace: OptionTrace
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
  offset?: number
}

export type IntImportPathRefInfo = {
  type: 'interface.import_path'
  target: RelativePath
}

export type InterfaceRefInfo = {
  file: AbsolutePath
  location: Node
} & (
  | IntLangPathRefInfo
  | IntResPathRefInfo
  | IntCtrlRefInfo
  | IntResRefInfo
  | IntTaskRefInfo
  | IntTaskEntryRefInfo
  | IntOptionRefInfo
  | IntCaseRefInfo
  | IntInputRefInfo
  | IntImportPathRefInfo
)

export type InterfaceInfo = {
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: LayerInfo
}

export type InterfaceParseContext = {
  maa: boolean
  file: AbsolutePath
  import: boolean
}

function parseController(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  let loc: Node | null = null
  const decl: IntCtrlDeclInfo = {
    type: 'interface.controller',
    name: '',
    attachs: []
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          loc = obj
          decl.name = obj.value
        }
        break
      case 'attach_resource_path':
        decl.attachs = parsePath(obj, info, ctx)
        break
    }
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'option':
        parseOptionRef(obj, info, ctx, {
          from: 'controller',
          origin: decl.name
        })
        break
    }
  }
  if (loc) {
    info.decls.push({
      file: ctx.file,
      location: loc,
      ...decl
    })
  }
}

function parseResource(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
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
        decl.paths = parsePath(obj, info, ctx)
        break
      case 'controller':
        decl.controller = parseCtrlRef(obj, info, ctx)
        break
    }
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'option':
        parseOptionRef(obj, info, ctx, {
          from: 'resource',
          origin: decl.name
        })
        break
    }
  }
  if (loc) {
    info.decls.push({
      file: ctx.file,
      location: loc,
      ...decl
    })
  }
}

function parseTaskSec(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  let name = ''
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'name':
        if (isString(obj)) {
          name = obj.value
          info.decls.push({
            file: ctx.file,
            location: obj,
            type: 'interface.task',
            name: obj.value as TaskName
          })
        }
        break
      case 'resource':
        parseResRef(obj, info, ctx)
        break
      case 'controller':
        parseCtrlRef(obj, info, ctx)
        break
      case 'pipeline_override':
        parseOverride(obj, info, ctx)
        break
    }
  }
  for (const [key, obj] of parseObject(node)) {
    switch (key) {
      case 'entry':
        if (isString(obj)) {
          info.refs.push({
            file: ctx.file,
            location: obj,
            type: 'interface.task_entry',
            target: obj.value as TaskName,
            task: name
          })
          info.layer.extraRefs.push({
            file: ctx.file,
            location: obj,
            type: 'task.entry',
            target: obj.value as TaskName
          })
        }
        break
      case 'option':
        parseOptionRef(obj, info, ctx, {
          from: 'task',
          origin: name
        })
        break
    }
  }
}

function parseLocalization(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  if (node.type === 'object') {
    for (const [key, obj] of parseObject(node)) {
      if (locKeys.includes(key) && isString(obj)) {
        if (obj.value.startsWith('$')) {
          info.layer.extraRefs.push({
            file: ctx.file,
            location: obj,
            type: 'task.locale',
            target: obj.value.substring(1)
          })
        } else {
          if (obj.value.length > 0) {
            info.layer.extraRefs.push({
              file: ctx.file,
              location: obj,
              type: 'task.can_locale',
              target: obj.value
            })
          }
        }
      } else {
        parseLocalization(obj, info, ctx)
      }
    }
  } else if (node.type === 'array') {
    for (const obj of parseArray(node)) {
      parseLocalization(obj, info, ctx)
    }
  }
}

export function parseInterface(node: Node, info: InterfaceInfo, ctx: InterfaceParseContext) {
  for (const [key, obj] of parseObject(node)) {
    if (ctx.import && !['option', 'task', 'preset'].includes(key)) {
      continue
    }
    switch (key) {
      case 'languages':
        parseLanguage(obj, info, ctx)
        break
      case 'controller':
        for (const sub of parseArray(obj)) {
          parseController(sub, info, ctx)
        }
        break
      case 'resource':
        for (const sub of parseArray(obj)) {
          parseResource(sub, info, ctx)
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
      case 'global_option':
        parseOptionRef(obj, info, ctx, {
          from: 'global',
          origin: ''
        })
        break
      case 'import':
        for (const sub of parseArray(obj)) {
          parseImport(sub, info, ctx)
        }
        break
      case 'preset':
        parsePreset(obj, info, ctx)
        break
    }
  }

  parseLocalization(node, info, ctx)
}
