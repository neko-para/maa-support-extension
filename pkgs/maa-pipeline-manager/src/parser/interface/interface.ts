import type { Node } from 'jsonc-parser'

import { LayerInfo } from '../../layer/layer'
import type { AbsolutePath, TaskName } from '../../utils/types'
import { type ParserConfig, isString, parseArray, parseObject } from '../utils'
import { parseCtrlRef } from './ctrlRef'
import { parseGroup } from './group'
import { parseImport } from './import'
import { locKeys } from './keys'
import { parseLanguage } from './language'
import { parseOption } from './option'
import { parseOptionRef } from './optionRef'
import { parseOverride } from './override'
import { parsePath } from './path'
import { parsePreset } from './preset'
import { parseResRef } from './resRef'
import type { IntCtrlDeclInfo, IntResDeclInfo, InterfaceDeclInfo, InterfaceRefInfo } from './types'

export type * from './types'

export type InterfaceInfo = {
  decls: InterfaceDeclInfo[]
  refs: InterfaceRefInfo[]
  layer: LayerInfo
}

export type InterfaceParseContext = {
  maa: boolean
  file: AbsolutePath
  import: boolean

  parser?: ParserConfig
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
      case 'group':
        for (const sub of parseArray(obj)) {
          if (isString(sub)) {
            info.refs.push({
              file: ctx.file,
              location: sub,
              type: 'interface.group',
              target: sub.value
            })
          }
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
      case 'group':
        for (const sub of parseArray(obj)) {
          parseGroup(sub, info, ctx)
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
