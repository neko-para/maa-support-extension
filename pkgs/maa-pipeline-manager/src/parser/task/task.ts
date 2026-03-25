import type { Node } from 'jsonc-parser'

import type { AbsolutePath, ImageRelativePath, TaskName } from '../../utils/types'
import {
  type ParserConfig,
  type PropPair,
  type PropSelectorResult,
  type StringNode,
  isNumber,
  isString,
  parseArray,
  parseUtils
} from '../utils'
import { parseAnchor } from './anchor'
import { parseColor } from './color'
import { parseColorFilter } from './colorFilter'
import { parseFocus } from './focus'
import { parseFreeze } from './freeze'
import { parseMaaBaseTask } from './maa/baseTask'
import { parseMaaExprList } from './maa/expr'
import { parseNextList } from './next'
import { parseRoi } from './roi'
import { type TaskParts, splitNode } from './split'
import { parseSubName } from './subName'
import { parseTarget } from './target'
import { parseTemplate } from './template'
import type { TaskDeclInfo, TaskMaaTaskRef, TaskRefInfo } from './types'

export type * from './types'

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

export type TaskParseContext = {
  maa: boolean
  file: AbsolutePath
  task: StringNode
  taskName: TaskName

  parser?: ParserConfig
}

function parseMaaBase(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'baseTask':
        parseMaaBaseTask(obj, info, ctx)
        break

      case 'sub':
      case 'next':
      case 'exceededNext':
      case 'onErrorNext':
      case 'reduceOtherTimes':
        parseMaaExprList(obj, info, ctx)
        break
    }
  }
}

function parseBase(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj] of props) {
    switch (key) {
      case 'next':
      case 'on_error':
        parseNextList(obj, info, ctx)
        break
      case 'anchor':
        parseAnchor(obj, info, ctx)
        break
      case 'pre_wait_freezes':
      case 'post_wait_freezes':
      case 'repeat_wait_freezes':
        parseFreeze(obj, info, ctx)
        break
      case 'focus':
        parseFocus(obj, info, ctx)
        break
      case 'doc':
      case 'desc':
        if (isString(obj)) {
          info.decls.push({
            file: ctx.file,
            location: obj,
            type: 'task.doc',
            task: ctx.taskName,
            doc: obj.value
          })
        }
        break
    }
  }
}

function parseMaaReco(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'template':
        parseTemplate(obj, info, ctx)
        break
    }
  }
}

function processCustom(
  result: PropSelectorResult,
  customName: string,
  customType: 'reco' | 'act',
  info: TaskInfo,
  ctx: TaskParseContext
) {
  switch (result.type) {
    case 'taskRef':
      info.refs.push({
        location: result.node,
        file: ctx.file,
        type: 'task.custom_task',
        target: result.node.value as TaskName,
        meta: {
          customName,
          customType,
          missingPolicy: result.missingPolicy ?? 'error'
        }
      })
      break
    case 'anchorRef':
      info.refs.push({
        location: result.node,
        file: ctx.file,
        type: 'task.custom_anchor',
        target: result.node.value,
        meta: {
          customName,
          customType,
          missingPolicy: result.missingPolicy ?? 'error'
        },

        attrs: {
          offset: 0,
          attrs: { Anchor: true },
          unknown: []
        }
      })
      break
    case 'template':
      info.refs.push({
        location: result.node,
        file: ctx.file,
        type: 'task.custom_template',
        target: result.node.value as ImageRelativePath,
        meta: {
          customName,
          customType,
          missingPolicy: result.missingPolicy ?? 'error'
        }
      })
      break
  }
}

function parseReco(
  props: PropPair[],
  baseProps: PropPair[],
  info: TaskInfo,
  prev: StringNode[],
  ctx: TaskParseContext,
  parent?: Node
) {
  let subName: StringNode | null = null
  let colorMatchMethod: 'rgb' | 'hsv' | null = 'rgb'
  let customReco: string | null = null
  for (const [key, obj] of props) {
    switch (key) {
      case 'roi':
        parseRoi(obj, info, prev, ctx)
        break
      case 'template':
        parseTemplate(obj, info, ctx)
        break
      case 'color_filter':
        parseColorFilter(obj, info, ctx)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          if (isString(sub)) {
            info.refs.push({
              file: ctx.file,
              location: sub,
              type: 'task.reco',
              target: sub.value as TaskName
            })
          } else {
            const subInfo = splitNode(sub, false)
            parseReco(subInfo.reco, subInfo.base, info, prev, ctx, sub)
          }
        }
        break
      case 'method':
        if (isNumber(obj)) {
          switch (obj.value) {
            case 4:
              colorMatchMethod = 'rgb'
              break
            case 40:
              colorMatchMethod = 'hsv'
              break
            default:
              colorMatchMethod = null
          }
        }
        break
      case 'custom_recognition':
        if (isString(obj)) {
          customReco = obj.value
        }
        break
    }
  }
  for (const [key, obj] of baseProps) {
    switch (key) {
      case 'sub_name':
        if (parent) {
          subName = parseSubName(obj, info, parent, ctx)
        }
        break
    }
  }
  if (subName) {
    prev.push(subName)
  }
  if (colorMatchMethod) {
    for (const [key, obj] of props) {
      switch (key) {
        case 'upper':
        case 'lower':
          parseColor(obj, info, ctx, colorMatchMethod)
          break
      }
    }
  }
  if (customReco) {
    for (const [key, obj] of props) {
      switch (key) {
        case 'custom_recognition_param':
          const refs = ctx.parser?.customReco?.call(ctx, customReco, obj, parseUtils) ?? []
          for (const ref of refs) {
            processCustom(ref, customReco, 'reco', info, ctx)
          }
          break
      }
    }
  }
}

function parseAct(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  let customAct: string | null = null
  for (const [key, obj] of props) {
    switch (key) {
      case 'target':
      case 'begin':
        parseTarget(obj, info, ctx)
        break
      case 'end':
        parseTarget(obj, info, ctx, true)
        break
      case 'custom_action':
        if (isString(obj)) {
          customAct = obj.value
        }
        break
    }
  }
  if (customAct) {
    for (const [key, obj] of props) {
      switch (key) {
        case 'custom_action_param':
          const refs = ctx.parser?.customAction?.call(ctx, customAct, obj, parseUtils) ?? []
          for (const ref of refs) {
            processCustom(ref, customAct, 'act', info, ctx)
          }
          break
      }
    }
  }
}

function parseUnknown(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, _obj, prop] of props) {
    if (key.startsWith('$__mpe')) {
      info.decls.push({
        file: ctx.file,
        location: prop,
        type: 'task.mpe_config'
      })
    }
  }
}

export function buildTaskRef(task: TaskName) {
  let offset = 0
  const tasks = (task.split('@') as TaskName[]).map(task => {
    const result: TaskMaaTaskRef = {
      task,
      taskSuffix: task,
      offset,
      length: task.length
    }
    offset += task.length + 1
    return result
  })
  let suffix = tasks[tasks.length - 1].task
  for (let idx = tasks.length - 2; idx >= 0; idx--) {
    suffix = `${tasks[idx].task}@${suffix}` as TaskName
    tasks[idx].taskSuffix = suffix
  }
  return tasks
}

export function parseTask(node: Node, ctx: TaskParseContext): TaskInfo {
  const parts = splitNode(node, ctx.maa)

  const info: TaskInfo = {
    parts,
    decls: [],
    refs: []
  }

  info.decls.push({
    file: ctx.file,
    location: ctx.task,
    type: 'task.decl',
    task: ctx.taskName,
    tasks: buildTaskRef(ctx.taskName)
  })

  if (ctx.maa) {
    parseMaaBase(info.parts.base, info, ctx)
    parseMaaReco(parts.reco, info, ctx)
  } else {
    parseBase(info.parts.base, info, ctx)
    parseReco(parts.reco, parts.base, info, [], ctx)
    parseAct(parts.act, info, ctx)
    parseUnknown(parts.unknown, info, ctx)
  }

  return info
}
