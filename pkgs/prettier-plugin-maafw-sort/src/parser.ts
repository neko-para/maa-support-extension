import {
  type Expression,
  type ObjectExpression,
  type ObjectMethod,
  type ObjectProperty,
  type PatternLike,
  type SpreadElement,
  type StringLiteral,
  stringLiteral
} from '@babel/types'
import * as path from 'node:path'
import type { ParserOptions } from 'prettier'
import { parsers as babelParsers } from 'prettier/plugins/babel'

import { parseOption } from './option'

interface BabelParseResult {
  node: Expression
}

function makeStringLit(value: string): StringLiteral {
  const node = stringLiteral(value)
  node.extra = {
    raw: JSON.stringify(value),
    rawValue: value
  }
  return node
}

function sortObject(
  node: ObjectExpression,
  orders: string[],
  mapper: [from: string, to: string][],
  value: Record<string, (val: Expression | PatternLike) => void>,
  keep?: (key: string) => boolean
) {
  const pendingProps: Record<string, ObjectProperty[]> = {}
  const unknownProps: (ObjectProperty | ObjectMethod | SpreadElement)[] = []
  const finalProps: (ObjectProperty | ObjectMethod | SpreadElement)[] = []
  const keptProps: [index: number, prop: ObjectProperty][] = []

  let index = 0
  for (const prop of node.properties) {
    const cur = index++
    if (prop.type === 'ObjectProperty') {
      if (prop.key.type === 'StringLiteral') {
        const key = prop.key.value

        // keep 命中的 key 不走 hooks、不参与排序（二者互斥；当前唯一
        // keep 调用点 interface root 不传 hooks）
        if (keep?.(key)) {
          keptProps.push([cur, prop])
          continue
        }

        if (value[key]) {
          value[key](prop.value)
        }

        if (orders.includes(key)) {
          pendingProps[key] = pendingProps[key] ?? []
          pendingProps[key].push(prop)
          continue
        }
      }
    }
    unknownProps.push(prop)
  }

  for (const [from, to] of mapper) {
    if (!pendingProps[from] || pendingProps[to]) {
      continue
    }
    pendingProps[to] = pendingProps[from].map(prop => {
      prop.key = makeStringLit(to)
      return prop
    })
    pendingProps[from] = []
  }

  for (const key of orders) {
    if (pendingProps[key]) {
      finalProps.push(...pendingProps[key])
    }
  }
  finalProps.push(...unknownProps)

  // keep 谓词命中的 key 不参与排序，按原始下标插回
  for (const [at, prop] of keptProps.reverse()) {
    finalProps.splice(Math.min(at, finalProps.length), 0, prop)
  }

  node.properties = finalProps
}

const recoKeys = [
  'custom_recognition',
  'custom_recognition_param',

  'roi',
  'roi_offset',

  'template',
  'green_mask',
  'method',

  'detector',
  'ratio',

  'lower',
  'upper',
  'connected',

  'expected',
  'replace',
  'only_rec',
  'model',
  'color_filter',
  'labels',
  'threshold',
  'count',

  'all_of',
  'any_of',
  'box_index',

  'order_by',
  'index'
]

export const actKeys = [
  'custom_action',
  'custom_action_param',

  'target',
  'target_offset',
  'begin',
  'begin_offset',
  'end',
  'end_offset',

  'end_hold',
  'only_hover',
  'duration',
  'contact',
  'pressure',

  'swipes',

  'dx',
  'dy',

  'key',

  'input_text',

  'package',

  'exec',
  'args',
  'detach',

  'cmd',
  'shell_timeout',

  'filename',
  'format',
  'quality'
]

const swipeKeys = [
  'starting',
  'begin',
  'begin_offset',
  'end',
  'end_offset',
  'duration',
  'end_hold',
  'only_hover',
  'contact',
  'pressure'
]

function processAllOfAnyOf(node: Expression | PatternLike) {
  if (node.type === 'ArrayExpression') {
    for (const elem of node.elements) {
      if (elem?.type === 'ObjectExpression') {
        processPipelineTask(elem)
      }
    }
  }
}

function processSwipes(node: Expression | PatternLike) {
  if (node.type === 'ObjectExpression') {
    sortObject(node, swipeKeys, [], {})
  }
}

function processPipelineTask(node: ObjectExpression) {
  sortObject(
    node,
    [
      'desc',
      'doc',

      'enabled',
      'max_hit',

      'sub_name',

      'recognition',
      ...recoKeys,

      'inverse',

      'pre_wait_freezes',
      'pre_delay',

      'action',
      ...actKeys,

      'anchor',

      'repeat',
      'repeat_wait_freezes',
      'repeat_delay',

      'post_wait_freezes',
      'post_delay',

      'timeout',
      'rate_limit',
      'next',
      'on_error',

      'focus',
      'attach'
    ],
    [['doc', 'desc']],
    {
      recognition: node => {
        if (node.type === 'ObjectExpression') {
          sortObject(node, ['type', 'param'], [], {
            param: node => {
              if (node.type === 'ObjectExpression') {
                sortObject(node, recoKeys, [], {
                  all_of: processAllOfAnyOf,
                  any_of: processAllOfAnyOf
                })
              }
            }
          })
        }
      },

      action: node => {
        if (node.type === 'ObjectExpression') {
          sortObject(node, ['type', 'param'], [], {
            param: node => {
              if (node.type === 'ObjectExpression') {
                sortObject(node, actKeys, [], {
                  swipes: processSwipes
                })
              }
            }
          })
        }
      },

      all_of: processAllOfAnyOf,
      any_of: processAllOfAnyOf,
      swipes: processSwipes
    }
  )
}

function processPipelineRoot(node: Expression | PatternLike) {
  if (node.type !== 'ObjectExpression') {
    return
  }
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      if (prop.value.type !== 'ObjectExpression') {
        continue
      }
      // 以 $ 开头的 root field 不是任务（如 $__mpe），不参与任务字段排序
      if (prop.key.type === 'StringLiteral' && prop.key.value.startsWith('$')) {
        continue
      }
      processPipelineTask(prop.value)
    }
  }
}

// 根序与各条目 key 顺序遵循 MaaFramework 协议文档正文的字段介绍顺序：
// https://github.com/MaaXYZ/MaaFramework/blob/main/docs/zh_cn/3.3-ProjectInterfaceV2协议.md
// （以 v2.10.1 / 2026-09 的 main 分支为准）。文档未记载的字段插在语义相邻
// 位置：auto_update_* 来自 MFAWPF 生态与本仓库 Interface 类型；
// default_controller/lock_controller 来自 MFAAvalonia；debug_session 来自
// 本仓库 AgentRuntime。
const interfaceRootKeys = [
  'interface_version',
  'languages',

  'name',
  'label',
  'title',
  'icon',
  'mirrorchyan_rid',
  'mirrorchyan_multiplatform',
  'auto_update_ui',
  'auto_update_maafw',
  'github',
  'version',
  'contact',
  'license',
  'welcome',
  'description',
  'telemetry',

  'controller',
  'default_controller',
  'lock_controller',

  'resource',

  'pretask',
  'agent',

  'group',
  'task',
  'option',
  'global_option',
  'setting',

  'import',
  'preset'
]

const controllerEntryKeys = [
  'name',
  'label',
  'description',
  'icon',

  'type',
  'display_short_side',
  'display_long_side',
  'display_expand',
  'display_raw',
  'permission_required',
  'attach_resource_path',
  'option',

  'adb',
  'win32',
  'macos',
  'playcover',
  'gamepad',
  'linux'
]

const resourceEntryKeys = [
  'name',
  'label',
  'description',
  'icon',
  'path',
  'controller',
  'option',
  'hash'
]

const taskEntryKeys = [
  'name',
  'label',
  'entry',
  'default_check',
  'description',
  'icon',
  'group',
  'resource',
  'controller',
  'pipeline_override',
  'option'
]

const optionEntryKeys = [
  'type',
  'controller',
  'resource',
  'label',
  'description',
  'icon',

  'cases',
  'inputs',
  'hotkeys',
  'pipeline_override',
  'default_case',
  'min_count',
  'max_count'
]

const caseEntryKeys = ['name', 'label', 'description', 'icon', 'option', 'pipeline_override']

const inputEntryKeys = [
  'name',
  'label',
  'description',
  'icon',
  'default',
  'pipeline_type',
  'verify',
  'pattern_msg',
  'password'
]

const hotkeyEntryKeys = ['name', 'label', 'description', 'icon', 'default']

const presetEntryKeys = ['name', 'label', 'description', 'icon', 'task']

const presetTaskEntryKeys = ['name', 'enabled', 'option']

const pretaskEntryKeys = [
  'resource',
  'controller',
  'exec',
  'args',
  'name',
  'label',
  'description',
  'icon',
  'option'
]

const settingEntryKeys = ['name', 'label', 'description', 'icon', 'option', 'default_expand']

const agentEntryKeys = ['child_exec', 'child_args', 'identifier', 'debug_session']

const groupEntryKeys = ['name', 'label', 'description', 'icon', 'default_expand']

type ValueHooks = Record<string, (val: Expression | PatternLike) => void>

function processEntryList(node: Expression | PatternLike, keys: string[], hooks: ValueHooks = {}) {
  if (node.type === 'ArrayExpression') {
    for (const elem of node.elements) {
      if (elem?.type === 'ObjectExpression') {
        sortObject(elem, keys, [], hooks)
      } else if (elem) {
        processInterfaceValue(elem)
      }
    }
  } else if (node.type === 'ObjectExpression') {
    // 单对象形态（协议允许 agent/pretask 单对象）：直接按条目排序
    sortObject(node, keys, [], hooks)
  } else {
    // 形状异常时退回 override 兜底遍历，不丢旧有的 pipeline_override 排序
    processInterfaceValue(node)
  }
}

// 未知结构的兜底遍历：只在任意深度寻找 pipeline_override 并按 pipeline 任务排序
function processInterfaceValue(node: Expression | PatternLike | SpreadElement) {
  if (node.type === 'ObjectExpression') {
    for (const prop of node.properties) {
      if (prop.type !== 'ObjectProperty') {
        continue
      }

      if (prop.key.type === 'StringLiteral' && prop.key.value === 'pipeline_override') {
        processPipelineRoot(prop.value)
        continue
      }

      processInterfaceValue(prop.value)
    }
  } else if (node.type === 'ArrayExpression') {
    for (const elem of node.elements) {
      if (elem) {
        processInterfaceValue(elem)
      }
    }
  }
}

function processInterfaceOptionRecord(node: Expression | PatternLike) {
  if (node.type === 'ObjectExpression') {
    for (const optProp of node.properties) {
      if (optProp.type === 'ObjectProperty' && optProp.value.type === 'ObjectExpression') {
        sortObject(optProp.value, optionEntryKeys, [], {
          cases: val =>
            processEntryList(val, caseEntryKeys, {
              pipeline_override: processPipelineRoot
            }),
          inputs: val => processEntryList(val, inputEntryKeys),
          hotkeys: val => processEntryList(val, hotkeyEntryKeys),
          pipeline_override: processPipelineRoot
        })
      } else if (optProp.type === 'ObjectProperty') {
        processInterfaceValue(optProp.value)
      }
    }
  } else {
    processInterfaceValue(node)
  }
}

function processInterfaceRoot(node: Expression) {
  if (node.type !== 'ObjectExpression') {
    return
  }

  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty' || prop.key.type !== 'StringLiteral') {
      continue
    }

    // $ 前缀 root field（如 $schema）不参与处理，排序时保持原位
    if (prop.key.value.startsWith('$')) {
      continue
    }

    switch (prop.key.value) {
      case 'controller':
        processEntryList(prop.value, controllerEntryKeys)
        break
      case 'resource':
        processEntryList(prop.value, resourceEntryKeys)
        break
      case 'task':
        processEntryList(prop.value, taskEntryKeys, {
          pipeline_override: processPipelineRoot
        })
        break
      case 'option':
        processInterfaceOptionRecord(prop.value)
        break
      case 'preset':
        processEntryList(prop.value, presetEntryKeys, {
          task: val => processEntryList(val, presetTaskEntryKeys)
        })
        break
      case 'group':
        processEntryList(prop.value, groupEntryKeys)
        break
      case 'pretask':
        processEntryList(prop.value, pretaskEntryKeys)
        break
      case 'setting':
        processEntryList(prop.value, settingEntryKeys)
        break
      case 'agent':
        processEntryList(prop.value, agentEntryKeys)
        break
      default:
        processInterfaceValue(prop.value)
        break
    }
  }

  sortObject(node, interfaceRootKeys, [], {}, key => key.startsWith('$'))
}

// 内容探测：被 import 的片段文件命名任意、不匹配 pattern，靠这里兜底。
// 为避免误伤无关 JSON，只认强信号：
// - task/controller/resource/preset 数组，且任一元素为含字符串 name 与对应
//   标志 key 的对象（task→entry、controller→type、resource→path、preset→task）
// - option Record，且存在含 cases/inputs/hotkeys/default_case/pipeline_override
//   的条目
// pipeline 文件的根任务值恒为对象，不会命中；仅含 group/global_option/setting
// 的片段信号太弱，不单独触发探测（可经 pattern 覆盖）。
const sectionMarkerKeys: Record<string, string> = {
  task: 'entry',
  controller: 'type',
  resource: 'path',
  preset: 'task'
}

const optionMarkerKeys = ['cases', 'inputs', 'hotkeys', 'default_case', 'pipeline_override']

function objectHasKey(
  node: ObjectExpression,
  key: string,
  valueOk: (val: Expression | PatternLike) => boolean
) {
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty' && prop.key.type === 'StringLiteral') {
      if (prop.key.value === key && valueOk(prop.value)) {
        return true
      }
    }
  }
  return false
}

function isStringLit(val: Expression | PatternLike) {
  return val.type === 'StringLiteral'
}

// 标志 key 的值形态：task.entry/controller.type 为字符串，resource.path 为
// 字符串或数组，preset.task 为数组
function markerValueOk(marker: string, val: Expression | PatternLike) {
  if (marker === 'path') {
    return val.type === 'StringLiteral' || val.type === 'ArrayExpression'
  }
  if (marker === 'task') {
    return val.type === 'ArrayExpression'
  }
  return isStringLit(val)
}

function looksLikeInterface(node: Expression) {
  if (node.type !== 'ObjectExpression') {
    return false
  }
  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty' || prop.key.type !== 'StringLiteral') {
      continue
    }

    const key = prop.key.value
    const marker = sectionMarkerKeys[key]
    if (marker) {
      if (prop.value.type !== 'ArrayExpression') {
        continue
      }
      for (const elem of prop.value.elements) {
        if (
          elem?.type === 'ObjectExpression' &&
          objectHasKey(elem, 'name', isStringLit) &&
          objectHasKey(elem, marker, val => markerValueOk(marker, val))
        ) {
          return true
        }
      }
    } else if (key === 'option' && prop.value.type === 'ObjectExpression') {
      for (const optProp of prop.value.properties) {
        if (optProp.type === 'ObjectProperty' && optProp.value.type === 'ObjectExpression') {
          for (const markerKey of optionMarkerKeys) {
            if (objectHasKey(optProp.value, markerKey, () => true)) {
              return true
            }
          }
        }
      }
    }
  }
  return false
}

// locale 文件（通常即 interface languages 指向的翻译 map）是纯数据，key 无
// 语义顺序，按 UTF-16 码元字典序（locale 无关、跨环境确定）递归排序全部对象
// key；数组顺序保留。注意 < 比较的是 UTF-16 码元而非码点，代理对字符的相对
// 顺序与严格码点序相反，实际 locale key 均在 BMP 内不受影响。
function processLocaleValue(node: Expression | PatternLike | SpreadElement) {
  if (node.type === 'ObjectExpression') {
    const props = [...node.properties]
    props.sort((left, right) => {
      const lk =
        left.type === 'ObjectProperty' && left.key.type === 'StringLiteral' ? left.key.value : null
      const rk =
        right.type === 'ObjectProperty' && right.key.type === 'StringLiteral'
          ? right.key.value
          : null
      if (lk === null || rk === null) {
        return 0
      }
      return lk < rk ? -1 : lk > rk ? 1 : 0
    })
    node.properties = props

    for (const prop of node.properties) {
      if (prop.type === 'ObjectProperty') {
        processLocaleValue(prop.value)
      }
    }
  } else if (node.type === 'ArrayExpression') {
    for (const elem of node.elements) {
      if (elem) {
        processLocaleValue(elem)
      }
    }
  }
}

type ParseFunc = (text: string, options: ParserOptions) => Promise<BabelParseResult>

export function createParser(parser: 'json' | 'jsonc', otherParse?: ParseFunc): ParseFunc {
  return async (text: string, prettierOptions: ParserOptions): Promise<BabelParseResult> => {
    otherParse = otherParse ?? babelParsers[parser].parse.bind(babelParsers[parser])
    const jsonRootAst = (await otherParse(text, prettierOptions)) as BabelParseResult

    if (!prettierOptions.filepath) {
      return jsonRootAst
    }

    const filepath = prettierOptions.filepath.replaceAll(path.sep, '/')

    const { pipelinePatterns, interfacePatterns, localePatterns, interfaceDetect } =
      parseOption(prettierOptions)

    for (const reg of pipelinePatterns) {
      if (reg.test(filepath)) {
        processPipelineRoot(jsonRootAst.node)
        return jsonRootAst
      }
    }

    for (const reg of interfacePatterns) {
      if (reg.test(filepath)) {
        processInterfaceRoot(jsonRootAst.node)
        return jsonRootAst
      }
    }

    for (const reg of localePatterns) {
      if (reg.test(filepath)) {
        processLocaleValue(jsonRootAst.node)
        return jsonRootAst
      }
    }

    if (interfaceDetect && looksLikeInterface(jsonRootAst.node)) {
      processInterfaceRoot(jsonRootAst.node)
    }

    return jsonRootAst
  }
}

export const parsers = {
  json: {
    ...babelParsers.json,
    parse: createParser('json')
  },
  jsonc: {
    ...babelParsers.jsonc,
    parse: createParser('jsonc')
  }
}
