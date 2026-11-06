import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectCustomRecognitionNames,
  requiredCustomRecognitions
} from '../src/tools/customReco.ts'

test('collectCustomRecognitionNames 识别 v1 / v2 的 Custom 识别名', () => {
  assert.deepEqual(
    collectCustomRecognitionNames(
      JSON.stringify({ recognition: 'Custom', custom_recognition: 'A' })
    ),
    ['A']
  )
  assert.deepEqual(
    collectCustomRecognitionNames(
      JSON.stringify({ recognition: { type: 'Custom', param: { custom_recognition: 'B' } } })
    ),
    ['B']
  )
})

test('collectCustomRecognitionNames 遍历 And / Or 内联子项且不展开节点名引用', () => {
  const v1 = {
    recognition: 'And',
    all_of: [
      { recognition: 'Custom', custom_recognition: 'C' },
      'NodeRef',
      {
        recognition: 'Or',
        any_of: [{ recognition: 'Custom', custom_recognition: 'D' }, 'OtherRef']
      }
    ]
  }
  assert.deepEqual(collectCustomRecognitionNames(JSON.stringify(v1)), ['C', 'D'])

  const v2 = {
    recognition: {
      type: 'And',
      param: {
        all_of: [
          { type: 'Custom', param: { custom_recognition: 'E' } },
          {
            type: 'Or',
            param: { any_of: [{ type: 'Custom', param: { custom_recognition: 'F' } }] }
          }
        ]
      }
    }
  }
  assert.deepEqual(collectCustomRecognitionNames(JSON.stringify(v2)), ['E', 'F'])
})

test('collectCustomRecognitionNames 兼容 5.12 平铺的内联子项', () => {
  const node = {
    recognition: 'And',
    all_of: [{ type: 'Custom', param: { custom_recognition: 'G' }, sub_name: 'sub' }]
  }
  assert.deepEqual(collectCustomRecognitionNames(JSON.stringify(node)), ['G'])
})

test('collectCustomRecognitionNames 对无效输入返回空数组', () => {
  assert.deepEqual(collectCustomRecognitionNames(null), [])
  assert.deepEqual(collectCustomRecognitionNames('not json'), [])
  assert.deepEqual(collectCustomRecognitionNames('null'), [])
})

test('requiredCustomRecognitions 递归展开 And / Or 的节点名引用', () => {
  const nodes: Record<string, string> = {
    Root: JSON.stringify({ recognition: 'And', all_of: ['N1', 'N2'] }),
    N1: JSON.stringify({ recognition: 'Custom', custom_recognition: 'A' }),
    N2: JSON.stringify({
      recognition: 'Or',
      any_of: [{ recognition: 'Custom', custom_recognition: 'B' }, 'N1']
    })
  }
  const result = requiredCustomRecognitions(['Root'], node => nodes[node] ?? null)
  assert.deepEqual(result, [
    { name: 'A', nodes: ['Root'] },
    { name: 'B', nodes: ['Root'] }
  ])
})

test('requiredCustomRecognitions 容忍循环引用、缺失节点与坏 JSON', () => {
  const nodes: Record<string, string> = {
    Root: JSON.stringify({ recognition: 'And', all_of: ['Loop', 'Missing', 'Bad'] }),
    Loop: JSON.stringify({
      recognition: 'Or',
      any_of: ['Root', { recognition: 'Custom', custom_recognition: 'C' }]
    }),
    Bad: '{'
  }
  const result = requiredCustomRecognitions(['Root'], node => nodes[node] ?? null)
  assert.deepEqual(result, [{ name: 'C', nodes: ['Root'] }])
})

test('requiredCustomRecognitions 展开 v2 And/Or 的节点名引用并去重（菱形引用）', () => {
  const nodes: Record<string, string> = {
    Root: JSON.stringify({
      recognition: { type: 'And', param: { all_of: ['A', 'B'] } }
    }),
    A: JSON.stringify({
      recognition: { type: 'Custom', param: { custom_recognition: 'X' } }
    }),
    B: JSON.stringify({
      recognition: {
        type: 'Or',
        param: { any_of: ['A', { type: 'Custom', param: { custom_recognition: 'Y' } }] }
      }
    })
  }
  const result = requiredCustomRecognitions(['Root'], node => nodes[node] ?? null)
  assert.deepEqual(result, [
    { name: 'X', nodes: ['Root'] },
    { name: 'Y', nodes: ['Root'] }
  ])
})

test('requiredCustomRecognitions 无 Custom 时返回空数组', () => {
  const nodes: Record<string, string> = {
    Root: JSON.stringify({ recognition: 'OCR', expected: 'ok' })
  }
  assert.deepEqual(
    requiredCustomRecognitions(['Root'], node => nodes[node] ?? null),
    []
  )
})
