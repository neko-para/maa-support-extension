import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import test from 'node:test'

import type { TestCases } from '../src/types/config'

const {
  compareTestCases,
  describeRunReason,
  formatRunFailures,
  formatRunSummary,
  getDefaultTestJobCount,
  groupResourcePlans
} = await createJiti(import.meta.url, { fsCache: false }).import<typeof import('../src/test/run')>(
  '../src/test/run.ts'
)

function testCases(controller: string, resource: string): TestCases {
  return {
    configs: { controller, resource },
    cases: []
  }
}

test('default test job count is an integer and at least one', () => {
  assert.equal(getDefaultTestJobCount(0), 1)
  assert.equal(getDefaultTestJobCount(1), 1)
  assert.equal(getDefaultTestJobCount(3), 1)
  assert.equal(getDefaultTestJobCount(8), 2)
  assert.equal(getDefaultTestJobCount(22), 5)
})

test('test cases use a stable controller then resource order', () => {
  const cases = [testCases('b', 'a'), testCases('a', 'b'), testCases('a', 'a')]

  cases.sort(compareTestCases)

  assert.deepEqual(
    cases.map(item => [item.configs.controller, item.configs.resource]),
    [
      ['a', 'a'],
      ['a', 'b'],
      ['b', 'a']
    ]
  )
})

test('resource plans reuse a group without changing plan order', () => {
  const plans = [
    { id: 'first', resourcePaths: ['base', 'shared'] },
    { id: 'second', resourcePaths: ['other'] },
    { id: 'third', resourcePaths: ['base', 'shared'] }
  ]

  const groups = groupResourcePlans(plans)

  assert.deepEqual(
    groups.map(group => group.map(plan => plan.id)),
    [['first', 'third'], ['second']]
  )
})

test('resource path order remains part of the pool identity', () => {
  const groups = groupResourcePlans([
    { id: 'forward', resourcePaths: ['base', 'override'] },
    { id: 'reverse', resourcePaths: ['override', 'base'] }
  ])

  assert.deepEqual(
    groups.map(group => group.map(plan => plan.id)),
    [['forward'], ['reverse']]
  )
})

test('resource path arrays cannot collide through delimiter placement', () => {
  const groups = groupResourcePlans([
    { id: 'left', resourcePaths: ['a-b', 'c'] },
    { id: 'right', resourcePaths: ['a', 'b-c'] }
  ])

  assert.equal(groups.length, 2)
})

test('汇总行按用例结论计数，只列非零类别并带上文件数与耗时', () => {
  assert.equal(
    formatRunSummary({
      files: [
        {
          cases: [
            { verdict: 'pass' },
            { verdict: 'pass' },
            { verdict: 'pass' },
            { verdict: 'pass' },
            { verdict: 'fail' },
            { verdict: 'skipped' }
          ]
        },
        { cases: [{ verdict: 'error' }] }
      ],
      durationMs: 3210
    }),
    '7 个用例：4 通过，1 失败，1 错误，1 跳过（2 个文件，用时 3.2s）'
  )
})

test('汇总行区分空运行、坏文件和全通过，不打印成串的 0', () => {
  assert.equal(
    formatRunSummary({ files: [{ cases: [], error: 'JSON 解析失败' }], durationMs: 12 }),
    '0 个用例：1 个文件解析失败（1 个文件，用时 0.0s）'
  )
  assert.equal(
    formatRunSummary({ files: [{ cases: [{ verdict: 'pass' }] }], durationMs: 65_400 }),
    '1 个用例：1 通过（1 个文件，用时 65.4s）'
  )
})

test('失败原因认得错误码就翻成人话并保留原码，认不出或已是人话时原样输出', () => {
  assert.equal(
    describeRunReason('no-tests-verified'),
    '没有任何用例完成有效验证，本次不能判定通过（no-tests-verified）'
  )
  assert.equal(describeRunReason('something-new'), 'something-new')
  assert.equal(
    describeRunReason('没有匹配到测试组，请检查配置、来源和过滤条件'),
    '没有匹配到测试组，请检查配置、来源和过滤条件'
  )
})

test('全部通过或全跳过时没有失败清单', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        { name: 'Demo', cases: [{ image: 'a.png', verdict: 'pass', platforms: [] }] },
        { name: 'Demo', cases: [{ image: 'b.png', verdict: 'skipped', platforms: [] }] }
      ]
    }),
    []
  )
})

test('失败清单一条用例一项，列出失败检查并保留组名与图片名', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          name: 'ControllerA:ResourceA',
          cases: [
            {
              image: 'example.png',
              verdict: 'fail',
              platforms: [
                {
                  controller: 'Desktop',
                  resource: 'Local',
                  result: {
                    checks: [
                      { node: 'Entry', ok: false, reason: 'should-hit' },
                      { node: 'Passed', ok: true },
                      {
                        node: 'Box',
                        ok: false,
                        reason: 'box-mismatch',
                        expectedBox: [1, 2, 3, 4],
                        detail: { box: [5, 6, 7, 8] }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }),
    [
      '失败用例（1 条）：',
      '  ControllerA:ResourceA  example.png',
      '    Entry should hit but missed',
      '    Box box mismatch. Expect [1,2,3,4], hit [5,6,7,8]'
    ]
  )
})

test('失败清单合并多平台重复明细，执行错误用错误原文，没有组名时退回 controller:resource', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          name: null,
          cases: [
            {
              image: 'boom.png',
              verdict: 'error',
              reason: 'test-execution-failed',
              platforms: [
                {
                  controller: 'Desktop',
                  resource: 'Local',
                  result: { checks: [], error: 'worker 崩了' }
                },
                {
                  controller: 'Desktop',
                  resource: 'Local',
                  result: { checks: [], error: 'worker 崩了' }
                }
              ]
            }
          ]
        }
      ]
    }),
    ['失败用例（1 条）：', '  Desktop:Local  boom.png', '    worker 崩了']
  )
})

test('失败清单在没有检查和错误时用用例原因兜底，不打印空明细', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          name: 'Demo',
          cases: [{ image: 'x.png', verdict: 'error', reason: 'no-tests-verified', platforms: [] }]
        }
      ]
    }),
    ['失败用例（1 条）：', '  Demo  x.png', '    no-tests-verified']
  )
})
