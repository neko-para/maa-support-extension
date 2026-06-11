/**
 * Interface 解析类型，基于 ProjectInterface V2 协议。
 * 控制器/算法枚举使用 string 代替 maa.* 品牌类型，留待 Phase 6 窄化。
 * controller/resource/task/preset/group 使用 Record 按 name 索引，插入序继承 JSON 数组序。
 */
import type { Node } from 'jsonc-parser'

import type { AbsolutePath, RelativePath } from '../types'

// ═══ Data types（runtime 消费） ═══

// ── EntryBase ──

export type EntryBase = {
  label?: string
  description?: string
  icon?: string
}

// ── Controller ──

export type ControllerBase = EntryBase & {
  type?: string
  display_short_side?: number
  display_long_side?: number
  display_raw?: boolean
  permission_required?: boolean
  attach_resource_path?: RelativePath[]
  option?: string[]
}

export type AdbController = ControllerBase & {
  type: 'Adb'
  adb?: never
  win32?: never
  playcover?: never
  gamepad?: never
}

export type Win32Controller = ControllerBase & {
  type: 'Win32'
  adb?: never
  win32?: {
    class_regex?: string
    window_regex?: string
    screencap?: string
    mouse?: string
    keyboard?: string
  }
  playcover?: never
  gamepad?: never
}

export type PlayCoverController = ControllerBase & {
  type: 'PlayCover'
  adb?: never
  win32?: never
  playcover?: { uuid?: string }
  gamepad?: never
}

export type GamepadController = ControllerBase & {
  type: 'Gamepad'
  adb?: never
  win32?: never
  playcover?: never
  gamepad?: {
    class_regex?: string
    window_regex?: string
    screencap?: string
    gamepad_type?: string
  }
}

export type Controller = AdbController | Win32Controller | PlayCoverController | GamepadController

// ── Resource ──

export type Resource = EntryBase & {
  path: RelativePath | RelativePath[]
  controller?: string[]
  option?: string[]
}

// ── Task ──

export type Task = EntryBase & {
  default_check?: boolean
  resource?: string[]
  controller?: string[]
  group?: string[]
  entry: string
  pipeline_override?: unknown
  option?: string[]
}

// ── Option ──

export type OptionBase = EntryBase & {
  controller?: string[]
  resource?: string[]
}

export type SelectCase = EntryBase & {
  option?: string[]
  pipeline_override?: unknown
}

export type SelectOption = OptionBase & {
  type?: 'select'
  cases?: Record<string, SelectCase>
  default_case?: string
}

export type CheckboxCase = EntryBase & {
  option?: string[]
  pipeline_override?: unknown
}

export type CheckboxOption = OptionBase & {
  type: 'checkbox'
  cases?: Record<string, CheckboxCase>
  default_case?: string[]
}

export type InputItemType = 'string' | 'int' | 'bool'

export type InputItem = EntryBase & {
  default?: string
  pipeline_type?: InputItemType
  verify?: string
  pattern_msg?: string
}

export type InputOption = OptionBase & {
  type: 'input'
  inputs?: Record<string, InputItem>
  pipeline_override?: unknown
}

export type SwitchCase = EntryBase & {
  option?: string[]
  pipeline_override?: unknown
}

export type SwitchOption = OptionBase & {
  type: 'switch'
  cases?: Record<string, SwitchCase>
  default_case?: string
}

export type Option = SelectOption | CheckboxOption | InputOption | SwitchOption

// ── Agent / Preset / Group ──

export type AgentConfig = {
  child_exec?: string
  child_args?: string[]
  identifier?: string
}

export type PresetTask = {
  enabled?: boolean
  option?: Record<string, string | string[] | Record<string, string>>
}

export type Preset = EntryBase & {
  task?: Record<string, PresetTask>
}

export type Group = EntryBase & {}

// ── ParsedInterface ──

export type ParsedInterface = EntryBase & {
  languages?: Record<string, string>
  name?: string
  mirrorchyan_rid?: string
  mirrorchyan_multiplatform?: boolean
  auto_update_ui?: boolean
  auto_update_maafw?: boolean
  github?: string
  version?: string
  contact?: string
  license?: string
  welcome?: string

  agent?: AgentConfig | AgentConfig[]

  controller: Record<string, Controller>
  resource: Record<string, Resource>
  task: Record<string, Task>
  option: Record<string, Option>
  global_option?: string[]
  preset: Record<string, Preset>
  group: Record<string, Group>

  import?: RelativePath[]
}

// ═══ Decl/Ref types（Diagnostic / Snapshot 消费） ═══

// ── Declarations ──

export type IntCtrlDeclInfo = {
  type: 'interface.controller'
  name: string
  location: Node
}

export type IntResDeclInfo = {
  type: 'interface.resource'
  name: string
  location: Node
}

export type IntTaskDeclInfo = {
  type: 'interface.task'
  name: string
  location: Node
}

export type IntOptionDeclInfo = {
  type: 'interface.option'
  name: string
  optionType?: string
  location: Node
}

export type IntCaseDeclInfo = {
  type: 'interface.case'
  name: string
  option: string
  location: Node
}

export type IntInputDeclInfo = {
  type: 'interface.input'
  name: string
  option: string
  cast?: 'string' | 'int' | 'bool'
  location: Node
}

export type IntPresetDeclInfo = {
  type: 'interface.preset'
  name: string
  location: Node
}

export type IntGroupDeclInfo = {
  type: 'interface.group'
  name: string
  location: Node
}

export type IntLangDeclInfo = {
  type: 'interface.language'
  name: string
  path: string
  location: Node
}

/** 解析器输出——不含 file，仅用于 parseInterface 返回值。 */
export type InterfaceDeclInfo =
  | IntCtrlDeclInfo
  | IntResDeclInfo
  | IntTaskDeclInfo
  | IntOptionDeclInfo
  | IntCaseDeclInfo
  | IntInputDeclInfo
  | IntPresetDeclInfo
  | IntGroupDeclInfo
  | IntLangDeclInfo

/** 完整声明——含 file。Snapshot / Diagnostic 层使用。 */
export type InterfaceDeclInFile = InterfaceDeclInfo & { file: AbsolutePath }

// ── References ──

export type IntImportPathRefInfo = {
  type: 'interface.import_path'
  target: RelativePath
  location: Node
}

export type IntLangPathRefInfo = {
  type: 'interface.language_path'
  target: string
  location: Node
}

export type IntResPathRefInfo = {
  type: 'interface.resource_path'
  target: RelativePath
  location: Node
}

export type IntCtrlRefInfo = {
  type: 'interface.controller'
  target: string
  location: Node
}

export type IntResRefInfo = {
  type: 'interface.resource'
  target: string
  location: Node
}

export type IntTaskRefInfo = {
  type: 'interface.task'
  target: string
  location: Node
}

export type IntTaskEntryRefInfo = {
  type: 'interface.task_entry'
  target: string
  task: string
  location: Node
}

export type OptionTrace = {
  from: 'global' | 'controller' | 'resource' | 'task' | 'option' | 'preset'
  origin: string
}

export type IntOptionRefInfo = {
  type: 'interface.option'
  target: string
  trace: OptionTrace
  location: Node
  presetValue?: Node
}

export type IntCaseRefInfo = {
  type: 'interface.case'
  target: string
  option: string
  location: Node
}

export type IntInputRefInfo = {
  type: 'interface.input'
  target: string
  option: string
  location: Node
  offset?: number
}

export type IntGroupRefInfo = {
  type: 'interface.group'
  target: string
  location: Node
}

/** 解析器输出——不含 file，仅用于 parseInterface 返回值。 */
export type InterfaceRefInfo =
  | IntImportPathRefInfo
  | IntLangPathRefInfo
  | IntResPathRefInfo
  | IntCtrlRefInfo
  | IntResRefInfo
  | IntTaskRefInfo
  | IntTaskEntryRefInfo
  | IntOptionRefInfo
  | IntCaseRefInfo
  | IntInputRefInfo
  | IntGroupRefInfo

/** 完整引用——含 file。Snapshot / Diagnostic 层使用。 */
export type InterfaceRefInFile = InterfaceRefInfo & { file: AbsolutePath }

// ═══ Parse result ═══

/** Parser 原始输出——不含 file。仅用于 parseInterface 返回值。 */
export type RawInterfaceParseResult = {
  readonly data: ParsedInterface
  readonly decls: readonly InterfaceDeclInfo[]
  readonly refs: readonly InterfaceRefInfo[]
  readonly node: Node
}

/** 完整解析结果——data + 已标注文件的 decl/ref。用于 merge 流程。 */
export type InterfaceParseResult = {
  readonly data: ParsedInterface
  readonly decls: readonly InterfaceDeclInFile[]
  readonly refs: readonly InterfaceRefInFile[]
}

/** 单文件视图——类似 pipeline 的 FileView。 */
export type InterfaceFileView = {
  readonly path: AbsolutePath
  readonly decls: readonly InterfaceDeclInFile[]
  readonly refs: readonly InterfaceRefInFile[]
}
