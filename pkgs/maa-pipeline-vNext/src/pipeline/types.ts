import type { Node } from 'jsonc-parser'

import type { MaaTaskExpr } from '@nekosu/maa-tasker'

import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../types'
import type { StringNode } from '../utils/parse'
import type { TaskAttrInfo } from './attr'

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
  | { type: 'task.decl'; task: TaskName; tasks: TaskMaaTaskRef[]; location: Node }
  | { type: 'task.anchor'; anchor: AnchorName; task: TaskName; belong: TaskName; location: Node }
  | { type: 'task.sub_reco'; name: string; reco: Node; task: TaskName; location: Node }
  | { type: 'task.locale'; key: string; value: string; valueNode: Node; location: Node }
  | { type: 'task.doc'; task: TaskName; doc: string; location: Node }
  | { type: 'task.mpe_config'; location: Node }

export type TaskDeclInfo = TaskDeclVariant
export type TaskDeclInFile = TaskDeclInfo & { file: AbsolutePath }

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
  location: Node
}

export type TaskTargetRefInfo = {
  type: 'task.target'
  target: TaskName
  attrs: TaskAttrInfo<'Anchor'>
  location: Node
}

export type TaskRoiRefInfo = {
  type: 'task.roi'
  target: TaskName
  attrs: TaskAttrInfo<'Anchor'>
  prev: StringNode[]
  task: TaskName
  prevRef: boolean
  location: Node
}

export type TaskRecoRefInfo = {
  type: 'task.reco'
  target: TaskName
  location: Node
}

export type TaskTemplateRefInfo = {
  type: 'task.template'
  target: ImageRelativePath
  location: Node
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
  location: Node
}

export type TaskCustomAnchorRefInfo = {
  type: 'task.custom_anchor'
  target: string
  meta: TaskCustomMeta
  attrs: TaskAttrInfo<'Anchor'>
  location: Node
}

export type TaskCustomTemplateRefInfo = {
  type: 'task.custom_template'
  target: ImageRelativePath
  meta: TaskCustomMeta
  location: Node
}

export type TaskEntryRefInfo = {
  type: 'task.entry'
  target: TaskName
  location: Node
}

export type TaskLocaleRefInfo = {
  type: 'task.locale'
  target: string
  location: Node
}

export type TaskLocaleTextRefInfo = {
  type: 'task.locale_text'
  target: string
  location: Node
}

export type TaskCanLocaleRefInfo = {
  type: 'task.can_locale'
  target: string
  location: Node
}

export type TaskColorRefInfo = {
  type: 'task.color'
  method: 'rgb' | 'hsv'
  color: number[]
  location: Node
}

export type TaskColorFilterRefInfo = {
  type: 'task.color_filter'
  target: TaskName
  location: Node
}

export type TaskAnchorRefInfo = {
  type: 'task.anchor'
  target: TaskName
  location: Node
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
  location: Node
}

export type TaskMaaExprRefInfo = {
  type: 'task.maa.expr'
  target: MaaTaskExpr
  tasks: TaskMaaTaskRef[]
  belong: TaskName
  location: Node
}

type MaaTaskRefVariant = TaskMaaBaseTaskRefInfo | TaskMaaExprRefInfo

export type TaskRefInfo = MaaFwTaskRefVariant | MaaTaskRefVariant
export type TaskRefInFile = TaskRefInfo & { file: AbsolutePath }

// ── Parsed Task ──

export type TaskInfo = {
  parts: TaskParts
  decls: TaskDeclInfo[]
  refs: TaskRefInfo[]
  prop: StringNode
  data: Node
}

/** Parser 原始输出的 TaskInfo，不含 file。仅用于 parsePipelineFile 返回值。 */
export type RawTaskInfo = TaskInfo

/** FileView 存储的任务信息——所有 decl/ref 已标注所属文件 */
export type TaskInfoInFile = Omit<TaskInfo, 'decls' | 'refs'> & {
  decls: TaskDeclInFile[]
  refs: TaskRefInFile[]
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
