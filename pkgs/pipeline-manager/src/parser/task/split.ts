import type { Node } from 'jsonc-parser'

import { type PropPair, parseObject } from '../utils'
import { actKeys, nodeKeys, recoKeys } from './keys'

export type TaskParts = {
  node: Node
  recoType?: Node
  actType?: Node
  base: PropPair[]
  reco: PropPair[]
  act: PropPair[]
  unknown: [key: string, value: Node][]
}

export function splitNode(node: Node) {
  const result: TaskParts = {
    node,
    base: [],
    reco: [],
    act: [],
    unknown: []
  }
  for (const pair of parseObject(node)) {
    const [key, obj] = pair
    if (nodeKeys.includes(key)) {
      result.base.push(pair)
    } else if (recoKeys.includes(key)) {
      result.reco.push(pair)
    } else if (actKeys.includes(key)) {
      result.act.push(pair)
    } else if (key === 'recognition') {
      if (obj.type === 'string') {
        result.recoType = obj
      } else if (obj.type === 'object') {
        const type = obj.children?.find(
          node => node.children?.[0].value === 'type' && node.children?.[1].type === 'string'
        )
        const param = obj.children?.find(
          node => node.children?.[0].value === 'param' && node.children?.[1].type === 'object'
        )
        if (type) {
          result.recoType = type.children![1]
        }
        for (const pair of parseObject(param?.children?.[1])) {
          if (recoKeys.includes(pair[0])) {
            result.reco.push(pair)
          }
        }
      }
    } else if (key === 'action') {
      if (obj.type === 'string') {
        result.actType = obj
      } else if (obj.type === 'object') {
        const type = obj.children?.find(
          node => node.children?.[0].value === 'type' && node.children?.[1].type === 'string'
        )
        const param = obj.children?.find(node => node.children?.[0].value === 'param')
        if (type) {
          result.actType = type.children![1]
        }
        for (const pair of parseObject(param?.children?.[1])) {
          if (actKeys.includes(pair[0])) {
            result.act.push(pair)
          }
        }
      }
    }
  }
  return result
}
