import type {
  Expression,
  ObjectExpression,
  ObjectMethod,
  ObjectProperty,
  SpreadElement,
  StringLiteral
} from '@babel/types'
import { stringLiteral } from '@babel/types'
import type { ParserOptions } from 'prettier'
import { parsers as babelParsers } from 'prettier/plugins/babel'

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

function processPipelineTask(node: ObjectExpression) {
  let docProp: ObjectProperty | undefined = undefined
  let descProp: ObjectProperty | undefined = undefined

  const finalProps: (ObjectProperty | ObjectMethod | SpreadElement)[] = []

  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      if (prop.key.type === 'StringLiteral') {
        if (prop.key.value === 'doc') {
          docProp = prop
          continue
        } else if (prop.key.value === 'desc') {
          descProp = prop
          continue
        }
      }
    }
    finalProps.push(prop)
  }

  if (docProp && !descProp) {
    docProp.key = makeStringLit('desc')
  }
  if (docProp) {
    finalProps.unshift(docProp)
  }
  if (descProp) {
    finalProps.unshift(descProp)
  }
  node.properties = finalProps
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

function createParser(
  parser: 'json' | 'jsonc'
): (text: string, options: ParserOptions) => Promise<BabelParseResult> {
  return async (text: string, prettierOptions: ParserOptions): Promise<BabelParseResult> => {
    const jsonRootAst = (await babelParsers[parser].parse(
      text,
      prettierOptions
    )) as BabelParseResult

    processPipelineRoot(jsonRootAst.node)

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
