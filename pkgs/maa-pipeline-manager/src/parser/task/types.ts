import type { Node } from 'jsonc-parser'

import type { MaaTaskExpr } from '@nekosu/maa-tasker'

import type { AbsolutePath, AnchorName, ImageRelativePath, TaskName } from '../../utils/types'
import type { StringNode } from '../utils'
import type { TaskAttrInfo } from './attr'

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
  attrs: TaskAttrInfo<'JumpBack' | 'Anchor'>
}

export type TaskTargetRefInfo = {
  type: 'task.target'
  target: TaskName // 有可能是 AnchorName
  attrs: TaskAttrInfo<'Anchor'>
}

export type TaskAnchorRefInfo = {
  type: 'task.anchor'
  target: TaskName
}

export type TaskRoiRefInfo = {
  type: 'task.roi'
  target: TaskName // 有可能是 subname或者AnchorName
  attrs: TaskAttrInfo<'Anchor'>
  prev: StringNode[]
  task: TaskName
  prevRef: boolean
}

// and_of any_of
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

  attrs: TaskAttrInfo<'Anchor'> // fake
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

type MaaFwTaskRefInfo =
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

type MaaTaskRefInfo = TaskMaaBaseTaskRefInfo | TaskMaaExprRefInfo

export type TaskRefInfo = {
  file: AbsolutePath
  location: Node
} & (MaaFwTaskRefInfo | MaaTaskRefInfo)
