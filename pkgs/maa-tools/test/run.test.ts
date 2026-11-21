import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import test from 'node:test'

import type { CheckFailureReason } from '../src/test/types'
import type { TestCases } from '../src/types/config'

const {
  compareTestCases,
  describeRunReason,
  formatRunFailures,
  formatRunSummary,
  formatUnusableFiles,
  getDefaultTestJobCount,
  groupResourcePlans
} = await createJiti(import.meta.url, { fsCache: false }).import<typeof import('../src/test/run')>(
  '../src/test/run.ts'
)

type RunCaseLike = import('../src/test/run').RunCaseLike

/** 造一条用例；platforms 为空表示没跑过的占位槽位。 */
function runCase(overrides: Partial<RunCaseLike> = {}): RunCaseLike {
  return { image: 'a.png', verdict: 'pass', platforms: [], ...overrides }
}

/** 造一个真跑过的平台结果；imagePath 非空即代表执行过。 */
function ranPlatform(
  controller: string,
  resource: string,
  overrides: {
    error?: string
    checks?: { node: string; ok: boolean; reason?: CheckFailureReason }[]
  } = {}
) {
  return {
    controller,
    resource,
    result: {
      imagePath: `/img/${controller}-${resource}.png`,
      checks: overrides.checks ?? [],
      ...(overrides.error ? { error: overrides.error } : {})
    }
  }
}

/** 造一个占位平台：整批失败时补出来的槽位，没有真实图片路径。 */
function placeholderPlatform(controller: string, resource: string, error: string) {
  return { controller, resource, result: { imagePath: '', error, checks: [] } }
}

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

test('计数行只数真跑过的用例，未执行与坏文件另计', () => {
  assert.equal(
    formatRunSummary({
      files: [
        {
          file: '/x/a.json',
          cases: [
            runCase({ verdict: 'pass', platforms: [ranPlatform('Desktop', 'Local')] }),
            runCase({ verdict: 'fail', platforms: [ranPlatform('Desktop', 'Local')] }),
            runCase({ verdict: 'skipped', platforms: [ranPlatform('Desktop', 'Local')] }),
            runCase({ image: 'b.png', verdict: 'error', platforms: [] })
          ]
        },
        { file: '/x/broken.json', error: 'JSON 解析失败', cases: [] }
      ],
      durationMs: 3210
    }),
    '3 个用例：1 通过，1 失败，1 跳过，1 个文件有错误（2 个文件，用时 3.2s，另有 1 个未执行）'
  )
})

test('一条都没跑时只报未执行条数，没有用例也没有坏文件时不打印计数行', () => {
  assert.equal(
    formatRunSummary({
      files: [
        {
          file: '/x/a.json',
          cases: [
            runCase({ verdict: 'error', platforms: [] }),
            runCase({ verdict: 'error', platforms: [] })
          ]
        }
      ],
      durationMs: 8
    }),
    '2 个用例未执行'
  )
  assert.equal(formatRunSummary({ files: [], durationMs: 8 }), '')
  assert.equal(formatRunSummary({ files: [{ file: '/x/a.json', cases: [] }], durationMs: 8 }), '')
})

test('占位平台不算执行过，真实跑过的跳过用例仍计入', () => {
  assert.equal(
    formatRunSummary({
      files: [
        {
          file: '/x/a.json',
          cases: [
            runCase({
              verdict: 'error',
              platforms: [placeholderPlatform('D', 'L', 'bundle 失败')]
            }),
            runCase({ verdict: 'skipped', platforms: [ranPlatform('D', 'L')] })
          ]
        }
      ],
      durationMs: 100
    }),
    '1 个用例：1 跳过（1 个文件，用时 0.1s，另有 1 个未执行）'
  )
})

test('不可用文件单独成段，带相对路径与原始原因', () => {
  assert.deepEqual(
    formatUnusableFiles({
      files: [
        { file: `${process.cwd()}/tests/broken.json`, error: 'JSON 解析失败：偏移 2', cases: [] },
        { file: '/x/ok.json', cases: [] }
      ]
    }),
    ['不可用文件（1 个）：', '  tests/broken.json  JSON 解析失败：偏移 2']
  )
  assert.deepEqual(formatUnusableFiles({ files: [] }), [])
})

test('失败清单只列真跑过的失败用例，占位槽位不算失败', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          file: '/x/a.json',
          name: 'Demo',
          cases: [
            runCase({ verdict: 'pass', platforms: [ranPlatform('Desktop', 'Local')] }),
            runCase({
              verdict: 'error',
              platforms: [placeholderPlatform('Desktop', 'Local', 'failed to load resource bundle')]
            })
          ]
        }
      ],
      durationMs: 0
    }),
    []
  )
})

test('失败清单列出失败检查，单平台明细不加前缀', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          file: '/x/a.json',
          name: 'ControllerA:ResourceA',
          cases: [
            runCase({
              verdict: 'fail',
              platforms: [
                ranPlatform('Desktop', 'Local', {
                  checks: [
                    { node: 'Entry', ok: false, reason: 'should-hit' },
                    { node: 'Passed', ok: true }
                  ]
                })
              ]
            })
          ]
        }
      ],
      durationMs: 0
    }),
    ['失败用例（1 条）：', '  ControllerA:ResourceA  a.png', '    Entry should hit but missed']
  )
})

test('多平台失败时逐平台列出明细，没有组名时不把平台写进行首', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          file: '/x/a.json',
          name: null,
          cases: [
            runCase({
              verdict: 'fail',
              platforms: [
                ranPlatform('Desktop', 'Local', {
                  checks: [{ node: 'A', ok: false, reason: 'no-result' }]
                }),
                ranPlatform('Win32', 'Global', {
                  checks: [{ node: 'B', ok: false, reason: 'no-result' }]
                })
              ]
            })
          ]
        }
      ],
      durationMs: 0
    }),
    [
      '失败用例（1 条）：',
      '  a.png',
      '    Desktop:Local  A no reco result.',
      '    Win32:Global  B no reco result.'
    ]
  )
})

test('失败清单保留执行错误原文，没有明细时用用例原因兜底', () => {
  assert.deepEqual(
    formatRunFailures({
      files: [
        {
          file: '/x/a.json',
          name: 'Demo',
          cases: [
            runCase({
              image: 'boom.png',
              verdict: 'error',
              platforms: [ranPlatform('Desktop', 'Local', { error: 'worker 崩了' })]
            }),
            runCase({
              image: 'quiet.png',
              verdict: 'error',
              reason: 'no-tests-verified',
              platforms: [ranPlatform('Desktop', 'Local')]
            })
          ]
        }
      ],
      durationMs: 0
    }),
    [
      '失败用例（2 条）：',
      '  Demo  boom.png',
      '    worker 崩了',
      '  Demo  quiet.png',
      '    no-tests-verified'
    ]
  )
})

test('整批原因以错误码翻人话，reason 只在是已知码或中文说明时使用', () => {
  assert.equal(
    describeRunReason(undefined, 'no-tests-verified'),
    '没有任何用例完成有效验证，本次不能判定通过（no-tests-verified）'
  )
  assert.equal(
    describeRunReason('resource-bundle-failed', 'failed to load resource bundle'),
    'interface 或资源加载失败（resource-bundle-failed）'
  )
  assert.equal(
    describeRunReason('test-config-missing', 'test config missing'),
    '配置里缺少 test 段，没有可运行的用例（test-config-missing）'
  )
  assert.equal(
    describeRunReason(
      'test-source-invalid',
      '用例 origin 无法对应实际测试文件与原始下标：/x.json [99]'
    ),
    '用例 origin 无法对应实际测试文件与原始下标：/x.json [99]（test-source-invalid）'
  )
  assert.equal(describeRunReason(undefined, 'MaaFW setup failed'), 'MaaFW setup failed')
  assert.equal(describeRunReason(undefined, 'constructor'), 'constructor')
  assert.equal(describeRunReason(undefined, undefined), '')
})
