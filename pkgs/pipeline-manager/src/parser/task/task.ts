import type { Node } from 'jsonc-parser'

import { type PropPair, parseArray, parseObject } from '../utils'
import { parseAnchor } from './anchor'
import { parseFreeze } from './freeze'
import { parseNextList } from './next'
import { parseRoi } from './roi'
import { type TaskParts, splitNode } from './split'
import { parseSubName } from './subName'
import { parseTarget } from './target'
import { parseTemplate } from './template'

export type TaskAnchorDeclInfo = {
  type: 'task.anchor'
  anchor: string
}

export type TaskSubRecoDeclInfo = {
  type: 'task.sub_reco'
  name: string
  reco: Node
}

export type TaskDeclInfo = {
  location: Node
} & (TaskAnchorDeclInfo | TaskSubRecoDeclInfo)

export type TaskNextRefInfo = {
  type: 'task.next'
  target: string
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
}

export type TaskTemplateRefInfo = {
  type: 'task.template'
  target: string
}

export type TaskRefInfo = {
  location: Node
} & (TaskNextRefInfo | TaskTargetRefInfo | TaskRoiRefInfo | TaskTemplateRefInfo)

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

function parseBase(props: PropPair[], info: TaskInfo) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'next':
      case 'on_error':
        parseNextList(obj, info)
        break
      case 'anchor':
        parseAnchor(obj, info)
        break
      case 'pre_wait_freezes':
      case 'post_wait_freezes':
      case 'repeat_wait_freezes':
        parseFreeze(obj, info)
        break
    }
  }
}

function parseReco(props: PropPair[], info: TaskInfo, parent?: Node) {
  for (const [prop, obj] of props) {
    switch (prop) {
      case 'roi':
        parseRoi(obj, info)
        break
      case 'template':
        parseTemplate(obj, info)
        break
      case 'all_of':
      case 'any_of':
        for (const sub of parseArray(obj)) {
          const subInfo = splitNode(sub)
          parseReco(subInfo.reco, info, sub)
        }
        break
      case 'sub_name':
        if (parent) {
          parseSubName(obj, info, parent)
        }
        break
    }
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

export function parseTask(node: Node): TaskInfo {
  const parts = splitNode(node)

  const info: TaskInfo = {
    parts,
    decls: [],
    refs: []
  }

  parseBase(info.parts.base, info)
  parseReco(parts.reco, info)
  parseAct(parts.act, info)

  return info
}
