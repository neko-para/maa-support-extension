import type { Node } from 'jsonc-parser'

import { type PropPair, type StringNode, isString, parseObject } from '../utils'
import { actKeys, nodeKeys, recoKeys } from './fw/keys'
import { actKeys as maaActKeys, nodeKeys as maaNodeKeys, recoKeys as maaRecoKeys } from './maa/keys'

export type TaskParts = {
  node: Node
  recoType?: StringNode
  actType?: StringNode
  base: PropPair[]
  reco: PropPair[]
  act: PropPair[]
  unknown: PropPair[]
}

export function splitNode(node: Node, maa: boolean) {
  if (maa) {
    return splitNodeSimple(node, 'algorithm', maaNodeKeys, maaRecoKeys, maaActKeys)
  }
  return splitNodeWithV2(node, nodeKeys, recoKeys, actKeys)
}

// MaaFramework: detects V1 (string) and V2 (object) recognition/action formats
function splitNodeWithV2(node: Node, nKeys: string[], rKeys: string[], aKeys: string[]) {
  const result: TaskParts = {
    node,
    base: [],
    reco: [],
    act: [],
    unknown: []
  }
  for (const pair of parseObject(node)) {
    const [key, obj] = pair
    if (key === 'recognition') {
      if (isString(obj)) {
        result.recoType = obj
      } else if (obj.type === 'object') {
        const type = obj.children?.find(
          n => n.children?.[0].value === 'type' && isString(n.children?.[1])
        )
        const param = obj.children?.find(n => n.children?.[0].value === 'param')
        if (type) {
          result.recoType = type.children![1] as StringNode
        }
        for (const p of parseObject(param?.children?.[1])) {
          if (rKeys.includes(p[0])) {
            result.reco.push(p)
          }
        }
      }
      continue
    }
    if (key === 'action') {
      if (isString(obj)) {
        result.actType = obj
      } else if (obj.type === 'object') {
        const type = obj.children?.find(
          n => n.children?.[0].value === 'type' && isString(n.children?.[1])
        )
        const param = obj.children?.find(n => n.children?.[0].value === 'param')
        if (type) {
          result.actType = type.children![1] as StringNode
        }
        for (const p of parseObject(param?.children?.[1])) {
          if (aKeys.includes(p[0])) {
            result.act.push(p)
          }
        }
      }
      continue
    }
    if (nKeys.includes(key)) {
      result.base.push(pair)
    } else if (rKeys.includes(key)) {
      result.reco.push(pair)
    } else if (aKeys.includes(key)) {
      result.act.push(pair)
    } else {
      result.unknown.push(pair)
    }
  }
  return result
}

// MAA: flat key-based classification, algorithm/action for type
function splitNodeSimple(
  node: Node,
  algoField: string,
  nKeys: string[],
  rKeys: string[],
  aKeys: string[]
) {
  const result: TaskParts = {
    node,
    base: [],
    reco: [],
    act: [],
    unknown: []
  }
  for (const pair of parseObject(node)) {
    const [key, obj] = pair
    if (key === algoField && isString(obj)) {
      result.recoType = obj
    } else if (key === 'action' && isString(obj)) {
      result.actType = obj
    } else if (nKeys.includes(key)) {
      result.base.push(pair)
    } else if (rKeys.includes(key)) {
      result.reco.push(pair)
    } else if (aKeys.includes(key)) {
      result.act.push(pair)
    } else {
      result.unknown.push(pair)
    }
  }
  return result
}
