import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGroupRunResult, evaluateCase, groupVerdict } from '../src/test/evaluate.ts'
import type {
  CaseCheckResult,
  CaseVerdict,
  RecoResult,
  TestCaseRunResult
} from '../src/test/types.ts'
import { createRecoJobs, distributeImageDurations } from '../src/test/utils.ts'
import type { TestCases } from '../src/types/config.ts'

type TestCase = TestCases['cases'][number]

const IMAGE_PATH = '/repo/tests/Testset/a.png'

function detailOf(box?: maa.Rect): maa.RecoDetail {
  return { hit: true, box } as unknown as maa.RecoDetail
}

function reco(
  node: string,
  hit: boolean,
  detail: maa.RecoDetail | null,
  imagePath = IMAGE_PATH,
  imagePathRaw = 'a.png'
): RecoResult {
  return { imagePath, imagePathRaw, node, hit, detail, pid: 1 }
}

function checkOf(checks: readonly CaseCheckResult[], node: string): CaseCheckResult {
  const found = checks.find(check => check.node === node)
  assert.ok(found, `缺少节点 ${node} 的检查结果`)
  return found
}

test('期望命中且命中：保留来源并通过', () => {
  const origin = { file: '/repo/tests/test_a.json', case: 3 }
  const result = evaluateCase(
    { image: 'a.png', hits: ['X'], origin },
    IMAGE_PATH,
    [reco('X', true, detailOf())],
    ['X']
  )

  assert.equal(result.verdict, 'pass')
  assert.equal(result.image, 'a.png')
  assert.equal(result.imagePath, IMAGE_PATH)
  assert.equal(result.durationMs, 0)
  assert.equal(result.error, undefined)
  assert.deepEqual(result.origin, origin)
  assert.equal(checkOf(result.checks, 'X').ok, true)
})

test('期望命中但没命中：should-hit', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: ['X'] },
    IMAGE_PATH,
    [reco('X', false, detailOf())],
    ['X']
  )

  assert.equal(result.verdict, 'fail')
  assert.equal(checkOf(result.checks, 'X').reason, 'should-hit')
})

test('期望框包含识别框：通过', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: [{ node: 'X', box: [10, 10, 100, 100] }] },
    IMAGE_PATH,
    [reco('X', true, detailOf([20, 20, 50, 50]))],
    ['X']
  )

  assert.equal(result.verdict, 'pass')
  assert.equal(checkOf(result.checks, 'X').ok, true)
})

test('识别框超出期望框或没有框：box-mismatch', () => {
  for (const box of [[10, 10, 200, 200], undefined] as const) {
    const result = evaluateCase(
      { image: 'a.png', hits: [{ node: 'X', box: [10, 10, 100, 100] }] },
      IMAGE_PATH,
      [reco('X', true, detailOf(box ? [...box] : undefined))],
      ['X']
    )

    assert.equal(result.verdict, 'fail')
    assert.equal(checkOf(result.checks, 'X').reason, 'box-mismatch')
  }
})

test('期望不命中却命中：should-miss', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: [] },
    IMAGE_PATH,
    [reco('X', true, detailOf())],
    ['X']
  )

  assert.equal(result.verdict, 'fail')
  assert.equal(checkOf(result.checks, 'X').expected, 'miss')
  assert.equal(checkOf(result.checks, 'X').reason, 'should-miss')
})

test('期望不命中且没命中：留下通过的检查明细', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: [] },
    IMAGE_PATH,
    [reco('X', false, detailOf())],
    ['X']
  )

  assert.equal(result.verdict, 'pass')
  assert.equal(checkOf(result.checks, 'X').ok, true)
  assert.equal(checkOf(result.checks, 'X').reason, undefined)
})

test('识别跑了但没有明细：期望命中和不命中都报 missing-detail', () => {
  for (const hits of [[], ['X']]) {
    const result = evaluateCase(
      { image: 'a.png', hits },
      IMAGE_PATH,
      [reco('X', false, null)],
      ['X']
    )

    assert.equal(result.verdict, 'fail')
    assert.equal(checkOf(result.checks, 'X').reason, 'missing-detail')
  }
})

test('期望命中的节点没有任何识别结果：no-result', () => {
  const result = evaluateCase({ image: 'a.png', hits: ['X'] }, IMAGE_PATH, [], ['X'])

  assert.equal(result.verdict, 'fail')
  assert.equal(checkOf(result.checks, 'X').expected, 'hit')
  assert.equal(checkOf(result.checks, 'X').reason, 'no-result')
})

test('有正例结果但负例节点的任务失踪：负例必须补 no-result', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: ['X'] },
    IMAGE_PATH,
    [reco('X', true, detailOf())],
    ['X', 'Y']
  )

  assert.equal(result.verdict, 'fail')
  assert.equal(checkOf(result.checks, 'X').ok, true)
  assert.equal(checkOf(result.checks, 'Y').expected, 'miss')
  assert.equal(checkOf(result.checks, 'Y').reason, 'no-result')
})

test('整张截图零结果：所有正负例节点逐一报 no-result', () => {
  const result = evaluateCase({ image: 'a.png', hits: ['X'] }, IMAGE_PATH, [], ['X', 'Y'])

  assert.equal(result.verdict, 'fail')
  assert.equal(result.error, 'no reco result for this image')
  assert.deepEqual(
    result.checks.map(check => [check.node, check.expected, check.reason]),
    [
      ['X', 'hit', 'no-result'],
      ['Y', 'miss', 'no-result']
    ]
  )
})

test('纯负例组没有任何待检查节点：明确报没验证，不通过', () => {
  const result = evaluateCase({ image: 'a.png', hits: [] }, IMAGE_PATH, [], [])

  assert.equal(result.verdict, 'error')
  assert.equal(result.error, 'no nodes to check')
  assert.deepEqual(result.checks, [])
})

test('完整组节点用于单条负例：保留其它用例贡献的所有断言', () => {
  const completeNodes = ['X', 'Y']
  const selectedCase: TestCase = { image: 'a.png', hits: [] }
  const jobs = createRecoJobs(
    [{ image: selectedCase.image, imagePath: IMAGE_PATH }],
    completeNodes,
    1
  )
  assert.deepEqual(
    jobs.map(job => job.nodes),
    [['X'], ['Y']]
  )
  const result = evaluateCase(
    selectedCase,
    IMAGE_PATH,
    [reco('X', true, detailOf()), reco('Y', true, detailOf())],
    completeNodes
  )

  assert.equal(result.verdict, 'fail')
  assert.deepEqual(
    result.checks.map(check => check.reason),
    ['should-miss', 'should-miss']
  )
})

test('其他图片的识别结果不参与判定，也不能掩盖本图缺结果', () => {
  const result = evaluateCase(
    { image: 'a.png', hits: ['X', 'Y'] },
    IMAGE_PATH,
    [reco('X', true, detailOf()), reco('Y', true, detailOf(), '/repo/other.png')],
    ['X', 'Y']
  )

  assert.equal(result.checks.length, 2)
  assert.equal(checkOf(result.checks, 'X').ok, true)
  assert.equal(checkOf(result.checks, 'Y').reason, 'no-result')
})

test('同图不同写法和不同期望框：复用一次识别，各自独立判定', () => {
  const cases: TestCase[] = [
    {
      image: 'a.png',
      hits: [{ node: 'X', box: [0, 0, 10, 10] }],
      origin: { file: '/repo/tests/test_a.json', case: 0 }
    },
    {
      image: './a.png',
      hits: [{ node: 'X', box: [20, 20, 10, 10] }],
      origin: { file: '/repo/tests/test_a.json', case: 1 }
    }
  ]
  const jobs = createRecoJobs(
    cases.map(testCase => ({ image: testCase.image, imagePath: IMAGE_PATH })),
    ['X'],
    50
  )
  assert.equal(jobs.length, 1)
  const results = [reco('X', true, detailOf([20, 20, 5, 5]), IMAGE_PATH, jobs[0].imagePathRaw)]
  const evaluated = cases.map(testCase => evaluateCase(testCase, IMAGE_PATH, results, ['X']))

  assert.deepEqual(
    evaluated.map(result => result.verdict),
    ['fail', 'pass']
  )
  assert.deepEqual(
    evaluated.map(result => result.origin?.case),
    [0, 1]
  )
})

test('同图去重后按节点分块：任务数只由唯一图片与完整节点集合决定', () => {
  const jobs = createRecoJobs(
    [
      { image: 'a.png', imagePath: IMAGE_PATH },
      { image: 'a.png', imagePath: IMAGE_PATH },
      { image: 'b.png', imagePath: '/repo/tests/Testset/b.png' }
    ],
    ['X', 'Y', 'Z'],
    2
  )

  assert.deepEqual(
    jobs.map(job => [job.imagePath, job.nodes]),
    [
      [IMAGE_PATH, ['X', 'Y']],
      [IMAGE_PATH, ['Z']],
      ['/repo/tests/Testset/b.png', ['X', 'Y']],
      ['/repo/tests/Testset/b.png', ['Z']]
    ]
  )
  assert.deepEqual(createRecoJobs([{ image: 'a.png', imagePath: IMAGE_PATH }], [], 50), [])
})

test('节点分块大小非法时明确报错，避免零步长或遗漏节点', () => {
  for (const size of [0, -1, 0.5, NaN, Infinity]) {
    assert.throws(
      () => createRecoJobs([{ image: 'a.png', imagePath: IMAGE_PATH }], ['X'], size),
      /positive integer/
    )
  }
})

function caseResult(verdict: CaseVerdict, durationMs = 0): TestCaseRunResult {
  return { image: 'a.png', imagePath: IMAGE_PATH, verdict, checks: [], durationMs }
}

const GROUP: TestCases = {
  configs: { controller: 'Controller', resource: 'Resource' },
  cases: []
}

test('同图任务耗时均分一次：case 之和与 group 耗时都等于实际工作耗时', () => {
  const paths = [IMAGE_PATH, IMAGE_PATH, '/repo/tests/Testset/b.png', IMAGE_PATH, '/missing.png']
  const durations = distributeImageDurations(
    paths,
    new Map([
      [IMAGE_PATH, 203.20849199999998],
      ['/repo/tests/Testset/b.png', 21]
    ])
  )

  assert.equal(durations[0], 203.20849199999998 / 3)
  assert.equal(durations[1], durations[0])
  assert.equal(durations[2], 21)
  assert.ok(Math.abs(durations[3] - durations[0]) < 1e-12)
  assert.equal(durations[4], 0)
  const total = durations.reduce((sum, duration) => sum + duration, 0)
  assert.ok(Math.abs(total - (203.20849199999998 + 21)) < 1e-12)
  const group = buildGroupRunResult(
    GROUP,
    durations.map(duration => caseResult('pass', duration))
  )
  assert.equal(group.durationMs, total)
})

test('只选一条复用用例时：这条承担全部真实任务耗时', () => {
  assert.deepEqual(distributeImageDurations([IMAGE_PATH], new Map([[IMAGE_PATH, 100]])), [100])
})

test('组结论：失败、错误、通过、跳过以及没有用例分别处理', () => {
  assert.equal(groupVerdict([caseResult('error'), caseResult('fail')]), 'fail')
  assert.equal(groupVerdict([caseResult('error'), caseResult('pass')]), 'error')
  assert.equal(groupVerdict([caseResult('pass'), caseResult('skipped')]), 'pass')
  assert.equal(groupVerdict([caseResult('skipped')]), 'skipped')
  assert.equal(groupVerdict([]), 'error')
})

test('结果组保留来源与 controller/resource 声明值', () => {
  const group = buildGroupRunResult(
    {
      source: '/repo/tests/Common/Button/test_close_button.json',
      configs: {
        name: '关闭按钮',
        controller: 'Win32',
        resource: '官服',
        imageRoot: 'Official_CN'
      },
      cases: [{ image: 'a.png', hits: ['X'] }]
    },
    [caseResult('pass', 12), caseResult('skipped')]
  )

  assert.equal(group.name, '关闭按钮')
  assert.equal(group.source, '/repo/tests/Common/Button/test_close_button.json')
  assert.equal(group.controller, 'Win32')
  assert.equal(group.resource, '官服')
  assert.equal(group.verdict, 'pass')
  assert.equal(group.durationMs, 12)
  assert.equal(group.cases.length, 2)
})

test('没写 name 时用 controller:resource，没有 source 就不添加', () => {
  const group = buildGroupRunResult(
    { configs: { controller: 'Controller', resource: 'Resource' }, cases: [] },
    [caseResult('skipped')]
  )

  assert.equal(group.name, 'Controller:Resource')
  assert.equal('source' in group, false)
  assert.equal(group.verdict, 'skipped')
})
