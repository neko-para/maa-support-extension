import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import type { RunTarget } from '../src/test/selection.ts'
import type { TestRunEvent } from '../src/test/types.ts'
import type { FullConfig } from '../src/types/config.ts'
import { assertPublicResult } from './assertions.ts'

test('配置缺失的前置错误也合并重复targets，完整发布两个选择后才结束文件', async () => {
  const { runTestDetailed } = await createJiti(import.meta.url, { fsCache: false }).import<
    typeof import('../src/test/run')
  >('../src/test/run.ts')
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
  assertPublicResult(final)
  assertPublicResult(events)
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

test('非法 test.job 在展开用例及准备 MaaFW 的 getter 前返回配置错误', async () => {
  const { runTestDetailed } = await createJiti(import.meta.url, { fsCache: false }).import<
    typeof import('../src/test/run')
  >('../src/test/run.ts')
  for (const job of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    null,
    '2'
  ]) {
    let prepareCalls = 0
    let casesCalls = 0
    const cfg: FullConfig = {
      interfacePath: 'unused',
      get maaCache(): string {
        prepareCalls++
        throw new Error('SETUP_MUST_NOT_RUN')
      },
      test: {
        job: job as number,
        get cases(): never {
          casesCalls++
          throw new Error('CASES_MUST_NOT_LOAD')
        }
      }
    }
    const events: TestRunEvent[] = []
    const result = await runTestDetailed(cfg, {
      onEvent: event => {
        events.push(event)
      }
    })
    assertPublicResult(result)
    assert.equal(result.status, 'error', String(job))
    assert.equal(result.errorCode, 'invalid-test-config', String(job))
    assert.match(result.reason!, /test\.job/)
    assert.equal(prepareCalls, 0)
    assert.equal(casesCalls, 0)
    assert.deepEqual(events, [])
  }
})
