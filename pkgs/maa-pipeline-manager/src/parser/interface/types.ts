import type { Node } from 'jsonc-parser'

import type { OptionTrace } from '../../logic'
import type { AbsolutePath, RelativePath, TaskName } from '../../utils/types'

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
  preset?: Node
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
