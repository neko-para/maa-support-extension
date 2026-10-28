import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import type { RunTarget } from '../src/test/filter.ts'
import type { TestRunEvent } from '../src/test/types.ts'

test('配置缺失的前置错误也合并重复targets，完整发布两个选择后才结束文件', async () => {
  const { runTestDetailed } = await createJiti(import.meta.url, { fsCache: false }).import<
    typeof import('../src/test/index')
  >('../src/test/index.ts')
  const file = path.resolve('early-error-tests/selected.json')
  const target: RunTarget = {
    file,
    controllers: ['C'],
    resources: ['R'],
    cases: [0, 1].map(index => ({
      index,
      name: null,
      image: 'same.png',
      hits: ['A'],
      start: index * 50,
      end: index * 50 + 40
    }))
  }
  const events: TestRunEvent[] = []
  const final = await runTestDetailed(
    { interfacePath: 'unused' },
    {
      targets: [
        { ...target, selected: [0] },
        { ...target, selected: [1] }
      ],
      onEvent: event => {
        events.push(event)
      }
    }
  )
  assert.equal(final.status, 'error')
  assert.equal(final.errorCode, 'test-config-missing')
  assert.equal(final.files.length, 1)
  assert.deepEqual(final.files[0].selectedCases, [0, 1])
  assert.deepEqual(
    final.files[0].cases.map(item => [item.index, item.verdict]),
    [
      [0, 'error'],
      [1, 'error']
    ]
  )
  assert.deepEqual(
    events.map(event => event.type),
    ['case-result', 'case-result', 'file-result']
  )
  for (const event of events) {
    assert.notEqual(event.type, 'case-started')
    if (event.type === 'case-started') continue
    assert.equal(event.result.errorCode, 'test-config-missing')
    if (event.type === 'case-result') {
      assert.deepEqual(event.result.files[0].selectedCases, [event.origin.case])
      assert.deepEqual(
        event.result.files[0].cases,
        final.files[0].cases.filter(item => item.index === event.origin.case)
      )
    } else {
      assert.deepEqual(event.result.files[0], final.files[0])
    }
  }
})
