import type { Node } from 'jsonc-parser'

import type { MaaTaskExpr } from '@nekosu/maa-tasker'

import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../../utils/types'
import { type PropPair, type StringNode, isNumber, isString, parseArray } from '../utils'
import { parseAnchor } from './anchor'
import { parseColor } from './color'
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

export type TaskMaaTaskRef = {
  task: TaskName
  taskSuffix: TaskName // 从当前位置到最右边
  offset: number
  length: number
}

export type TaskPropDeclInfo = {
  type: 'task.decl'
  task: TaskName
  tasks: TaskMaaTaskRef[]
}

export type TaskAnchorDeclInfo = {
  type: 'task.anchor'
  anchor: AnchorName
  task: TaskName
  belong: TaskName
}

export type TaskSubRecoDeclInfo = {
  type: 'task.sub_reco'
  name: string
  reco: Node
  task: TaskName
}

export type TaskLocaleDeclInfo = {
  type: 'task.locale'
  key: string
  value: string
  valueNode: Node
}

export type TaskDocDeclInfo = {
  type: 'task.doc'
  task: TaskName
  doc: string
}

export type TaskMpeConfigDeclInfo = {
  type: 'task.mpe_config'
}

export type TaskDeclInfo = {
  file: AbsolutePath
  location: Node
} & (
  | TaskPropDeclInfo
  | TaskAnchorDeclInfo
  | TaskSubRecoDeclInfo
  | TaskLocaleDeclInfo
  | TaskDocDeclInfo
  | TaskMpeConfigDeclInfo
)

export type TaskNextRefInfo = {
  type: 'task.next'
  target: TaskName // 有可能是 AnchorName
  objMode: boolean
  offset?: number
  jumpBack?: boolean
  anchor?: boolean
  unknown?: [attr: string, offset: number, length: number][]
}

export type TaskTargetRefInfo = {
  type: 'task.target'
  target: TaskName
}

export type TaskAnchorRefInfo = {
  type: 'task.anchor'
  target: TaskName
}

export type TaskRoiRefInfo = {
  type: 'task.roi'
  prev: StringNode[]
  task: TaskName
} & (
  | {
      prevRef?: false
      target: TaskName
    }
  | {
      prevRef: true
      target: string // SubName
    }
)

export type TaskTemplateRefInfo = {
  type: 'task.template'
  target: ImageRelativePath
}

export type TaskEntryRefInfo = {
  type: 'task.entry'
  target: TaskName
}

export type TaskLocaleRefInfo = {
  type: 'task.locale'
  target: string
}

export type TaskLocaleTextRefInfo = {
  type: 'task.locale_text'
  target: string
}

export type TaskCanLocaleRefInfo = {
  type: 'task.can_locale'
  target: string
}

export type TaskColorRefInfo = {
  type: 'task.color'
  method: 'rgb' | 'hsv'
  color: number[]
}

type MaaFwTaskRefInfo =
  | TaskNextRefInfo
  | TaskTargetRefInfo
  | TaskAnchorRefInfo
  | TaskRoiRefInfo
  | TaskTemplateRefInfo
  | TaskEntryRefInfo
  | TaskLocaleRefInfo
  | TaskLocaleTextRefInfo
  | TaskCanLocaleRefInfo
  | TaskColorRefInfo

export type TaskMaaBaseTaskRefInfo = {
  type: 'task.maa.base_task'
  target: TaskName
  tasks: TaskMaaTaskRef[]
  belong: TaskName
}

export type TaskMaaExprRefInfo = {
  type: 'task.maa.expr'
  target: MaaTaskExpr
  tasks: TaskMaaTaskRef[]
  belong: TaskName
}

type MaaTaskRefInfo = TaskMaaBaseTaskRefInfo | TaskMaaExprRefInfo

export type TaskRefInfo = {
  file: AbsolutePath
  location: Node
} & (MaaFwTaskRefInfo | MaaTaskRefInfo)

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
  for (const [key, obj, prop] of props) {
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

function parseReco(
  props: PropPair[],
  info: TaskInfo,
  prev: StringNode[],
  ctx: TaskParseContext,
  parent?: Node
) {
  let subName: StringNode | null = null
  let colorMatchMethod: 'rgb' | 'hsv' | null = 'rgb'
  for (const [key, obj] of props) {
    switch (key) {
      case 'roi':
        parseRoi(obj, info, prev, ctx)
        break
      case 'template':
        parseTemplate(obj, info, ctx)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          if (isString(sub)) {
            info.refs.push({
              file: ctx.file,
              location: sub,
              type: 'task.roi',
              target: sub.value as TaskName,
              prev: [],
              task: ctx.taskName
            })
          } else {
            const subInfo = splitNode(sub, false)
            parseReco(subInfo.reco, info, prev, ctx, sub)
          }
        }
        break
      case 'sub_name':
        if (parent) {
          subName = parseSubName(obj, info, parent, ctx)
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
}

function parseAct(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj] of props) {
    switch (key) {
      case 'target':
      case 'begin':
        parseTarget(obj, info, ctx)
        break
      case 'end':
        parseTarget(obj, info, ctx, true)
        break
    }
  }
}

function parseUnknown(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [key, obj, prop] of props) {
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
    parseReco(parts.reco, info, [], ctx)
    parseAct(parts.act, info, ctx)
    parseUnknown(parts.unknown, info, ctx)
  }

  return info
}
