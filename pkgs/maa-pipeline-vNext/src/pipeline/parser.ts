import { type Node, parseTree } from 'jsonc-parser'

import type { ImageRelativePath } from '../types'
import { type StringNode, eachOrOne, isString, parseObject as parseObj } from '../utils/parse'
import { actKeys, maaActKeys, maaNodeKeys, maaRecoKeys, nodeKeys, recoKeys } from './keys'
import type { TaskParts, TaskRefInfo } from './types'

export function splitNode(node: Node, maa: boolean): TaskParts {
  const result: TaskParts = {
    node,
    base: [],
    reco: [],
    act: [],
    unknown: []
  }

  if (maa) {
    for (const pair of parseObj(node)) {
      const [key, obj] = pair
      if (key === 'algorithm' && isString(obj)) {
        result.recoType = obj
      } else if (key === 'action' && isString(obj)) {
        result.actType = obj
      } else if (maaNodeKeys.includes(key)) {
        result.base.push(pair)
      } else if (maaRecoKeys.includes(key)) {
        result.reco.push(pair)
      } else if (maaActKeys.includes(key)) {
        result.act.push(pair)
      } else {
        result.unknown.push(pair)
      }
    }
    return result
  }

  for (const pair of parseObj(node)) {
    const [key, obj] = pair
    if (nodeKeys.includes(key)) {
      result.base.push(pair)
    } else if (recoKeys.includes(key)) {
      result.reco.push(pair)
    } else if (actKeys.includes(key)) {
      result.act.push(pair)
    } else if (key === 'recognition') {
      parseRecognitionField(obj, result)
    } else if (key === 'action') {
      parseActionField(obj, result)
    } else {
      result.unknown.push(pair)
    }
  }

  return result
}

function extractV2TypeParam(obj: Node): { type?: StringNode; param?: Node } {
  const children = obj.children
  if (!children) {
    return {}
  }
  const typeNode = children.find(
    n => n.children?.[0]?.value === 'type' && isString(n.children?.[1])
  )
  const paramNode = children.find(n => n.children?.[0]?.value === 'param')
  return {
    type: typeNode ? (typeNode.children![1] as StringNode) : undefined,
    param: paramNode?.children?.[1]
  }
}

function parseRecognitionField(obj: Node, result: TaskParts) {
  if (isString(obj)) {
    result.recoType = obj
  } else if (obj.type === 'object') {
    const { type, param } = extractV2TypeParam(obj)
    if (type) {
      result.recoType = type
    }
    for (const pair of parseObj(param)) {
      if (recoKeys.includes(pair[0])) {
        result.reco.push(pair)
      }
    }
  }
}

function parseActionField(obj: Node, result: TaskParts) {
  if (isString(obj)) {
    result.actType = obj
  } else if (obj.type === 'object') {
    const { type, param } = extractV2TypeParam(obj)
    if (type) {
      result.actType = type
    }
    for (const pair of parseObj(param)) {
      if (actKeys.includes(pair[0])) {
        result.act.push(pair)
      }
    }
  }
}

export function parseTreeWithoutParent(content: string): Node | undefined {
  const node = parseTree(content)
  if (node) {
    type DeepWritable<T> = { -readonly [P in keyof T]: DeepWritable<T[P]> }
    const shrink = (n: Node) => {
      delete (n as DeepWritable<Node>).parent
      for (const c of n.children ?? []) {
        shrink(c)
      }
    }
    shrink(node)
  }
  return node
}

export function parseTemplate(node: Node, refs: TaskRefInfo[]) {
  eachOrOne(node, n => {
    if (isString(n)) {
      refs.push({ type: 'task.template', target: n.value as ImageRelativePath })
    }
  })
}
