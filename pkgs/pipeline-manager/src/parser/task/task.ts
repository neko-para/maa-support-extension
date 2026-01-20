import type { Node } from 'jsonc-parser'

import type { AnchorName, ImageRelativePath, TaskName } from '../../utils/types'
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
}

export type TaskDeclInfo = {
  location: Node
} & (TaskPropDeclInfo | TaskAnchorDeclInfo | TaskSubRecoDeclInfo)

export type TaskNextRefInfo = {
  type: 'task.next'
  target: string
  objMode: boolean
  offset?: number
  jumpBack?: boolean
  anchor?: boolean
}

export type TaskTargetRefInfo = {
  type: 'task.target'
  target: string
}

export type TaskRoiRefInfo = {
  type: 'task.roi'
  target: string
  prev: StringNode[]
}

export type TaskTemplateRefInfo = {
  type: 'task.template'
  target: ImageRelativePath
}

export type TaskEntryRefInfo = {
  type: 'task.entry'
  target: string
}

export type TaskRefInfo = {
  location: Node
} & (TaskNextRefInfo | TaskTargetRefInfo | TaskRoiRefInfo | TaskTemplateRefInfo | TaskEntryRefInfo)

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

function parseBase(props: PropPair[], info: TaskInfo, task: TaskName) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'next':
      case 'on_error':
        parseNextList(obj, info)
        break
      case 'anchor':
        parseAnchor(obj, info, task)
        break
      case 'pre_wait_freezes':
      case 'post_wait_freezes':
      case 'repeat_wait_freezes':
        parseFreeze(obj, info)
        break
    }
  }
}

function parseReco(props: PropPair[], info: TaskInfo, prev: StringNode[], parent?: Node) {
  let subName: StringNode | null = null
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'roi':
        parseRoi(obj, info, prev)
        break
      case 'template':
        parseTemplate(obj, info)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          const subInfo = splitNode(sub)
          parseReco(subInfo.reco, info, prev, sub)
        }
        break
      case 'sub_name':
        if (parent) {
          subName = parseSubName(obj, info, parent)
        }
        break
    }
  }
  if (subName) {
    prev.push(subName)
  }
}

function parseAct(props: PropPair[], info: TaskInfo) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'target':
      case 'begin':
        parseTarget(obj, info)
        break
      case 'end':
        parseTarget(obj, info, true)
        break
    }
  }
}

export function parseTask(node: Node, task: StringNode): TaskInfo {
  const parts = splitNode(node)

  const info: TaskInfo = {
    parts,
    decls: [],
    refs: []
  }

  info.decls.push({
    location: task,
    type: 'task.decl',
    task: task.value as TaskName
  })

  parseBase(info.parts.base, info, task.value as TaskName)
  parseReco(parts.reco, info, [])
  parseAct(parts.act, info)

  return info
}
