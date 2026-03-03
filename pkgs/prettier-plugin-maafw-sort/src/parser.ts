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
  value: Record<string, (val: Expression | PatternLike) => void>
) {
  const pendingProps: Record<string, ObjectProperty[]> = {}
  const unknownProps: (ObjectProperty | ObjectMethod | SpreadElement)[] = []
  const finalProps: (ObjectProperty | ObjectMethod | SpreadElement)[] = []

  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      if (prop.key.type === 'StringLiteral') {
        const key = prop.key.value

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
      'inverse',
      'max_hit',

      'sub_name',

      'recognition',
      ...recoKeys,

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

function processPipelineRoot(node: Expression) {
  if (node.type !== 'ObjectExpression') {
    return
  }
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      if (prop.value.type !== 'ObjectExpression') {
        continue
      }
      processPipelineTask(prop.value)
    }
  }
}

function processInterfaceRoot(node: Expression | PatternLike | SpreadElement) {
  if (node.type === 'ObjectExpression') {
    for (const prop of node.properties) {
      if (prop.type !== 'ObjectProperty') {
        continue
      }

      if (prop.key.type === 'StringLiteral' && prop.key.value === 'pipeline_override') {
        if (prop.value.type === 'ObjectExpression') {
          processPipelineRoot(prop.value)
          continue
        }
      }

      processInterfaceRoot(prop.value)
    }
  } else if (node.type === 'ArrayExpression') {
    for (const elem of node.elements) {
      if (elem) {
        processInterfaceRoot(elem)
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

    const { pipelinePatterns, interfacePatterns } = parseOption(prettierOptions)

    for (const reg of pipelinePatterns) {
      if (reg.test(filepath)) {
        console.error('use pipeline mode')
        processPipelineRoot(jsonRootAst.node)
        return jsonRootAst
      }
    }

    for (const reg of interfacePatterns) {
      if (reg.test(filepath)) {
        console.error('use interface mode')
        processInterfaceRoot(jsonRootAst.node)
        return jsonRootAst
      }
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
