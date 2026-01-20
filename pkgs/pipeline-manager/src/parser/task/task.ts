import type { Node } from 'jsonc-parser'

import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../../utils/types'
import { type PropPair, type StringNode, parseArray, parseObject } from '../utils'
import { parseAnchor } from './anchor'
import { parseFreeze } from './freeze'
import { parseNextList } from './next'
import { parseRoi } from './roi'
import { type TaskParts, splitNode } from './split'
import { parseSubName } from './subName'
import { parseTarget } from './target'
import { parseTemplate } from './template'

export type TaskPropDeclInfo = {
  type: 'task.decl'
  task: TaskName
}

export type TaskAnchorDeclInfo = {
  type: 'task.anchor'
  anchor: AnchorName
  task: TaskName
}

export type TaskSubRecoDeclInfo = {
  type: 'task.sub_reco'
  name: string
  reco: Node
  task: TaskName
}

export type TaskDeclInfo = {
  file: AbsolutePath
  location: Node
} & (TaskPropDeclInfo | TaskAnchorDeclInfo | TaskSubRecoDeclInfo)

export type TaskNextRefInfo = {
  type: 'task.next'
  target: TaskName // 有可能是 AnchorName
  objMode: boolean
  offset?: number
  jumpBack?: boolean
  anchor?: boolean
}

export type TaskTargetRefInfo = {
  type: 'task.target'
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

export type TaskRefInfo = {
  file: AbsolutePath
  location: Node
} & (TaskNextRefInfo | TaskTargetRefInfo | TaskRoiRefInfo | TaskTemplateRefInfo | TaskEntryRefInfo)

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

export type TaskParseContext = {
  file: AbsolutePath
  task: StringNode
}

function parseBase(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [prop, obj] of props) {
    switch (prop) {
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
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'roi':
        parseRoi(obj, info, prev, ctx)
        break
      case 'template':
        parseTemplate(obj, info, ctx)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          const subInfo = splitNode(sub)
          parseReco(subInfo.reco, info, prev, ctx, sub)
        }
        break
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
}

function parseAct(props: PropPair[], info: TaskInfo, ctx: TaskParseContext) {
  for (const [prop, obj] of props) {
    switch (prop) {
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

export function parseTask(node: Node, ctx: TaskParseContext): TaskInfo {
  const parts = splitNode(node)

  const info: TaskInfo = {
    parts,
    decls: [],
    refs: []
  }

  info.decls.push({
    file: ctx.file,
    location: ctx.task,
    type: 'task.decl',
    task: ctx.task.value as TaskName
  })

  parseBase(info.parts.base, info, ctx)
  parseReco(parts.reco, info, [], ctx)
  parseAct(parts.act, info, ctx)

  return info
}
