import { describe, expect, test } from 'vitest'

import { evalTask } from '../../../src/core/eval/eval-task'
import type { LayerTaskInfo } from '../../../src/layer/layer'
import { parseObject } from '../../../src/parser/utils'
import { parseTreeWithoutParent } from '../../../src/utils/json'
import type { AbsolutePath } from '../../../src/utils/types'

function infoFromJson(json: string): LayerTaskInfo {
  const tree = parseTreeWithoutParent(json)!
  const propPairs = [...parseObject(tree)]
  return {
    file: '/test/tasks.json' as AbsolutePath,
    prop: propPairs[0][2],
    data: propPairs[0][1],
    info: {
      parts: { node: tree, base: propPairs, reco: [], act: [], unknown: [] },
      decls: [],
      refs: []
    },
    obj: {}
  }
}

describe('evalTask', () => {
  test('returns empty object for undefined info', () => {
    const result = evalTask(undefined, undefined, {}, {}, {})
    expect(result).toEqual({})
  })

  test('merges with parent result', () => {
    const info = infoFromJson('{ "template": "child.png" }')
    const result = evalTask(info, { template: 'parent.png', timeout: 3000 }, {}, {}, {})
    expect(result.template).toBe('child.png')
    expect(result.timeout).toBe(3000)
  })

  test('applies defaults when no parent result', () => {
    const info = infoFromJson('{ "next": "TaskB" }')
    const result = evalTask(info, undefined, { pre_delay: 200 }, {}, {})
    expect(result.pre_delay).toBe(200)
    expect(result.next).toBe('TaskB')
  })
})
