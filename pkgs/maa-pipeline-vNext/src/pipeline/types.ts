import type { Node } from 'jsonc-parser'

import type { MaaTaskExpr } from '@nekosu/maa-tasker'

import type { AnchorName, ImageRelativePath, TaskName } from '../types'
import type { StringNode } from '../utils/parse'
import type { TaskAttrInfo } from './attr'

// ── Task Parts ──

export type TaskParts = {
  node: Node
  recoType?: StringNode
  actType?: StringNode
  base: [prop: string, value: Node, propNode: StringNode][]
  reco: [prop: string, value: Node, propNode: StringNode][]
  act: [prop: string, value: Node, propNode: StringNode][]
  unknown: [prop: string, value: Node, propNode: StringNode][]
}

// ── Declarations ──

export type TaskDeclVariant =
  | { type: 'task.decl'; task: TaskName; tasks: TaskMaaTaskRef[] }
  | { type: 'task.anchor'; anchor: AnchorName; task: TaskName; belong: TaskName }
  | { type: 'task.sub_reco'; name: string; reco: Node; task: TaskName }
  | { type: 'task.locale'; key: string; value: string; valueNode: Node }
  | { type: 'task.doc'; task: TaskName; doc: string }
  | { type: 'task.mpe_config' }

/** 解析器输出——不含 file/location。由调用方添加。 */
export type TaskDeclInfo = TaskDeclVariant

export type TaskMaaTaskRef = {
  task: TaskName
  taskSuffix: TaskName
  offset: number
  length: number
}

// ── References ──

export type TaskNextRefInfo = {
  type: 'task.next'
  target: TaskName
  objMode: boolean
  attrs: TaskAttrInfo<'JumpBack' | 'Anchor'>
}

export type TaskTargetRefInfo = {
  type: 'task.target'
  target: TaskName
  attrs: TaskAttrInfo<'Anchor'>
}

export type TaskRoiRefInfo = {
  type: 'task.roi'
  target: TaskName
  attrs: TaskAttrInfo<'Anchor'>
  prev: StringNode[]
  task: TaskName
  prevRef: boolean
}

export type TaskRecoRefInfo = {
  type: 'task.reco'
  target: TaskName
}

export type TaskTemplateRefInfo = {
  type: 'task.template'
  target: ImageRelativePath
}

export type TaskCustomMeta = {
  customName: string
  customType: 'reco' | 'act'
  missingPolicy: 'error' | 'warning' | 'ignore'
}

export type TaskCustomTaskRefInfo = {
  type: 'task.custom_task'
  target: TaskName
  meta: TaskCustomMeta
}

export type TaskCustomAnchorRefInfo = {
  type: 'task.custom_anchor'
  target: string
  meta: TaskCustomMeta
  attrs: TaskAttrInfo<'Anchor'>
}

export type TaskCustomTemplateRefInfo = {
  type: 'task.custom_template'
  target: ImageRelativePath
  meta: TaskCustomMeta
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

export type TaskColorFilterRefInfo = {
  type: 'task.color_filter'
  target: TaskName
}

export type TaskAnchorRefInfo = {
  type: 'task.anchor'
  target: TaskName
}

type MaaFwTaskRefVariant =
  | TaskNextRefInfo
  | TaskTargetRefInfo
  | TaskAnchorRefInfo
  | TaskRoiRefInfo
  | TaskRecoRefInfo
  | TaskTemplateRefInfo
  | TaskCustomTaskRefInfo
  | TaskCustomAnchorRefInfo
  | TaskCustomTemplateRefInfo
  | TaskEntryRefInfo
  | TaskLocaleRefInfo
  | TaskLocaleTextRefInfo
  | TaskCanLocaleRefInfo
  | TaskColorRefInfo
  | TaskColorFilterRefInfo

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

type MaaTaskRefVariant = TaskMaaBaseTaskRefInfo | TaskMaaExprRefInfo

/** 解析器输出——不含 file。由调用方添加。 */
export type TaskRefInfo = MaaFwTaskRefVariant | MaaTaskRefVariant

/** 完整引用信息——含 file 和位置。用于 Snapshot / Diagnostic。 */
export type TaskRefInFile = TaskRefInfo & { file: string; location: Node }

/** 完整声明信息——含 file 和位置。用于 Snapshot / Diagnostic。 */
export type TaskDeclInFile = TaskDeclInfo & { file: string; location: Node }

// ── Parsed Task ──

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
}

// ── Parser Config ──

export type PropSelectorResult =
  | { type: 'taskRef'; node: StringNode; missingPolicy: 'error' | 'warning' | 'ignore' }
  | { type: 'anchorRef'; node: StringNode; missingPolicy: 'error' | 'warning' | 'ignore' }
  | { type: 'template'; node: StringNode; missingPolicy: 'error' | 'warning' | 'ignore' }

export type PropSelector = (
  name: string,
  param: Node,
  utils: {
    parseObject: typeof import('../utils/parse').parseObject
    parseObjectFlex: typeof import('../utils/parse').parseObjectFlex
    parseArray: typeof import('../utils/parse').parseArray
    isString: typeof import('../utils/parse').isString
    isNumber: typeof import('../utils/parse').isNumber
    isBool: typeof import('../utils/parse').isBool
  }
) => PropSelectorResult[]

export type ParserConfig = {
  customReco?: PropSelector
  customAction?: PropSelector
}

export type TaskParseContext = {
  maa: boolean
  file: string
  task: StringNode
  taskName: TaskName
  parser?: ParserConfig
}
