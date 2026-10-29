import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { type TestContext } from 'node:test'

import { buildGroupRunResult } from '../src/test/evaluate.ts'
import { expandTestGroups } from '../src/test/plan.ts'
import { buildTestRunResult } from '../src/test/report.ts'
import type { ListedFile, TestCaseRunResult, TestGroupRunResult } from '../src/test/types.ts'
import type { TestCases } from '../src/types/config.ts'
import { assertPublicResult } from './assertions.ts'

const fileA = path.resolve('source-tests/a.json')
const fileB = path.resolve('source-tests/b.json')

async function realSources(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-tools-report-file-plan-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const files = ['a.json', 'b.json'].map(name => path.join(root, name))
  for (const file of files) {
    await fs.writeFile(
      file,
      JSON.stringify({
        configs: { controller: 'C', resource: 'R' },
        cases: [0, 1, 2].map(() => ({ image: 'same.png', hits: ['A'] }))
      })
    )
  }
  return { fileA: files[0], fileB: files[1] }
}

function metadata(file = fileA, indexes = [0], controllers = ['C']): ListedFile {
  return {
    file,
    name: '源文件组名',
    controllers,
    resources: ['R'],
    cases: indexes.map(index => ({
      index,
      name: null,
      image: 'same.png',
      hits: ['A'],
      start: index * 100,
      end: index * 100 + 50
    }))
  }
}

function result(
  file = fileA,
  index = 0,
  verdict: TestCaseRunResult['verdict'] = 'pass'
): TestCaseRunResult {
  return {
    image: 'same.png',
    imagePath: path.resolve('images/same.png'),
    origin: { file, case: index },
    verdict,
    checks:
      verdict === 'skipped' || verdict === 'error'
        ? []
        : [
            {
              node: 'A',
              expected: 'hit',
              hit: verdict === 'pass',
              detail: null,
              ok: verdict === 'pass',
              ...(verdict === 'fail' ? { reason: 'should-hit' as const } : {})
            }
          ],
    durationMs: 12,
    ...(verdict === 'error' ? { error: 'no-result' } : {})
  }
}

function group(cases: TestCaseRunResult[], controller = 'C'): TestGroupRunResult {
  return {
    name: '同名组',
    controller,
    resource: 'R',
    cases,
    verdict: cases.some(item => item.verdict === 'fail')
      ? 'fail'
      : cases.some(item => item.verdict === 'error')
        ? 'error'
        : cases.some(item => item.verdict === 'pass')
          ? 'pass'
          : 'skipped',
    durationMs: cases.reduce((sum, item) => sum + item.durationMs, 0)
  }
}

function planned(file = fileA, indexes = [0], controller = 'C'): TestCases {
  return {
    configs: { controller, resource: 'R' },
    cases: indexes.map(index => ({
      image: 'same.png',
      hits: ['A'],
      origin: { file, case: index }
    })),
    nodes: ['A']
  }
}

test('同名组仍按origin归位，文件case完整覆盖选中下标，保留原metadata和平台', () => {
  const a = metadata(fileA, [0, 2])
  const b = metadata(fileB)
  const report = buildTestRunResult({
    files: [a, b],
    groups: [group([result(fileA), result(fileA, 2, 'fail')]), group([result(fileB)])],
    durationMs: 100
  })
  assertPublicResult(report)
  assert.equal(report.status, 'failed')
  assert.equal(report.durationMs, 100)
  assert.deepEqual(report.files[0].selectedCases, [0, 2])
  assert.deepEqual(
    report.files[0].cases.map(item => item.verdict),
    ['pass', 'fail']
  )
  assert.equal(report.files[0].verdict, 'fail')
  assert.equal(report.files[1].verdict, 'pass')
  assert.equal(report.files[0].cases[1].start, 200)
  assert.equal(report.files[0].cases[1].platforms[0].controller, 'C')
})

test('所选case缺结果显式生成error条目，不能由其它用例通过掩盖', () => {
  const report = buildTestRunResult({
    files: [metadata(fileA, [0, 2])],
    groups: [group([result()])],
    plannedGroups: [planned(fileA, [0, 2])],
    durationMs: 0
  })
  assert.equal(report.status, 'error')
  assert.deepEqual(report.files[0].selectedCases, [0, 2])
  assert.equal(report.files[0].cases[1].verdict, 'error')
  const missing = report.files[0].cases[1].platforms[0].result
  assert.equal(missing.verdict, 'error')
  assert.equal(missing.error, 'no-result')
  assert.equal(missing.imagePath, '')
  assert.deepEqual(missing.checks, [])
  assert.equal(missing.durationMs, 0)
})

test('零匹配返回empty/no-tests-matched，同时明确列所选case为error且无伪造平台', () => {
  const report = buildTestRunResult({ files: [metadata()], groups: [], durationMs: 0 })
  assert.equal(report.status, 'empty')
  assert.equal(report.errorCode, 'no-tests-matched')
  assert.deepEqual(report.files[0].selectedCases, [0])
  assert.equal(report.files[0].cases[0].verdict, 'error')
  assert.equal(report.files[0].cases[0].reason, 'no-tests-matched')
  assert.deepEqual(report.files[0].cases[0].platforms, [])
})

test('某平台通过另一个平台缺图：case跳过，文件仍通过并保留未验证平台', () => {
  const report = buildTestRunResult({
    files: [metadata(fileA, [0], ['C', 'Other'])],
    groups: [group([result()]), group([result(fileA, 0, 'skipped')], 'Other')],
    durationMs: 0
  })
  assert.equal(report.status, 'passed')
  assert.equal(report.files[0].verdict, 'pass')
  assert.equal(report.files[0].reason, 'some-platforms-skipped')
  assert.equal(report.files[0].cases[0].verdict, 'skipped')
  assert.deepEqual(
    report.files[0].cases[0].platforms.map(platform => platform.result.verdict),
    ['pass', 'skipped']
  )
})

test('全部缺图或没有任何有效检查都不能判通过', () => {
  const skipped = buildTestRunResult({
    files: [metadata()],
    groups: [group([result(fileA, 0, 'skipped')])],
    durationMs: 0
  })
  assert.equal(skipped.status, 'error')
  assert.equal(skipped.files[0].verdict, 'error')
  const noChecks = { ...result(), checks: [] }
  const report = buildTestRunResult({
    files: [metadata()],
    groups: [group([noChecks])],
    durationMs: 0
  })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-verification-error')
})

test('坏文件不阻断好文件的独立结论，顶层错误优先于其它文件失败', () => {
  const bad = { ...metadata(fileB, []), error: 'JSON解析失败' }
  const report = buildTestRunResult({
    files: [metadata(), bad],
    groups: [group([result()])],
    durationMs: 0
  })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-file-error')
  assert.equal(report.files[0].verdict, 'pass')
  assert.equal(report.files[1].verdict, 'error')
})

test('同一组/同一文件fail会遮住case error时，顶层仍优先error', () => {
  const report = buildTestRunResult({
    files: [metadata(fileA, [0, 1])],
    groups: [group([result(fileA, 0, 'fail'), result(fileA, 1, 'error')])],
    durationMs: 0
  })
  assert.equal(report.files[0].verdict, 'fail')
  assert.deepEqual(
    report.files[0].cases.map(testCase => testCase.verdict),
    ['fail', 'error']
  )
  assert.equal(report.status, 'error')
})

test('内部结果缺少来源也明确报错，不能pass或empty', () => {
  const sourceLess = { ...result(), origin: undefined } as unknown as TestCaseRunResult
  const report = buildTestRunResult({ files: [], groups: [group([sourceLess])], durationMs: 0 })
  assertPublicResult(report)
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-source-invalid')
  assert.deepEqual(report.files, [])
  assert.equal(buildTestRunResult({ files: [], groups: [], durationMs: 0 }).status, 'empty')
})

test('loader主动只展开一个平台时不从原文件声明凭空补另一个平台', () => {
  const report = buildTestRunResult({
    files: [metadata(fileA, [0], ['C', 'Excluded'])],
    groups: [group([result()])],
    plannedGroups: [planned()],
    durationMs: 0
  })
  assert.equal(report.status, 'passed')
  assert.deepEqual(report.files[0].controllers, ['C', 'Excluded'])
  assert.deepEqual(
    report.files[0].cases[0].platforms.map(platform => platform.controller),
    ['C']
  )
})

test('实际计划非空但整组结果未返回时是执行错误，不误报零匹配', () => {
  const report = buildTestRunResult({
    files: [metadata()],
    groups: [],
    plannedGroups: [planned()],
    durationMs: 1
  })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-verification-error')
  assert.equal(report.files[0].cases[0].verdict, 'error')
  assert.equal(report.files[0].cases[0].platforms[0].result.error, 'no-result')
})

test('实际计划有平台但执行未返回，补准确平台error；启动错误保留全部选择', () => {
  const report = buildTestRunResult({
    files: [metadata()],
    groups: [],
    plannedGroups: [planned()],
    durationMs: 2,
    errorCode: 'maa-setup-failed',
    reason: '准备失败'
  })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'maa-setup-failed')
  assert.deepEqual(report.files[0].selectedCases, [0])
  assert.equal(report.files[0].cases[0].reason, '准备失败')
  assert.equal(report.files[0].cases[0].platforms[0].result.error, 'maa-setup-failed')
})

for (const axis of ['controller', 'resource'] as const) {
  for (const verdict of ['pass', 'fail'] as const) {
    test(`${axis}过滤掉整个文件时跳过空文件，保留另一个文件的${verdict}`, async t => {
      const { fileA, fileB } = await realSources(t)
      const first = { ...planned(fileA, [0], 'C2'), configs: { controller: 'C2', resource: 'R2' } }
      const second = { ...planned(fileB, [0], 'C1'), configs: { controller: 'C1', resource: 'R1' } }
      const expanded = await expandTestGroups(
        { interfacePath: 'unused', test: { cases: [first, second] } },
        {
          targets: [metadata(fileA), metadata(fileB)],
          ...(axis === 'controller' ? { controllers: ['C1'] } : { resources: ['R1'] })
        }
      )
      const report = buildTestRunResult({
        files: expanded.files,
        groups: [buildGroupRunResult(expanded.groups[0], [result(fileB, 0, verdict)])],
        plannedGroups: expanded.groups,
        durationMs: 1
      })
      assert.equal(report.status, verdict === 'pass' ? 'passed' : 'failed')
      assert.equal(report.errorCode, undefined)
      assert.equal(report.files[0].verdict, 'skipped')
      assert.equal(report.files[0].reason, 'no-cases-selected')
      assert.deepEqual(report.files[0].selectedCases, [])
      assert.deepEqual(report.files[0].cases, [])
      assert.equal(report.files[1].verdict, verdict)
    })
  }
}

test('全部文件被平台过滤时仍为empty，空文件本身记跳过而非通过', async t => {
  const { fileA, fileB: _fileB } = await realSources(t)
  const expanded = await expandTestGroups(
    { interfacePath: 'unused', test: { cases: [planned(fileA)] } },
    {
      targets: [metadata(fileA)],
      controllers: ['excluded']
    }
  )
  const report = buildTestRunResult({
    files: expanded.files,
    groups: [],
    plannedGroups: expanded.groups,
    durationMs: 0
  })
  assert.equal(report.status, 'empty')
  assert.equal(report.errorCode, 'no-tests-matched')
  assert.equal(report.files[0].verdict, 'skipped')
  assert.equal(report.files[0].reason, 'no-cases-selected')
})

test('零case跳过不掩盖坏文件或另一个文件有选择却缺结果', () => {
  const empty = metadata(fileA, [])
  const bad = { ...metadata(fileB, []), error: 'bad file' }
  const badReport = buildTestRunResult({ files: [empty, bad], groups: [], durationMs: 0 })
  assert.equal(badReport.status, 'error')
  assert.equal(badReport.errorCode, 'test-file-error')
  assert.equal(badReport.files[1].verdict, 'error')
  const missing = buildTestRunResult({
    files: [empty, metadata(fileB)],
    groups: [],
    plannedGroups: [planned(fileB)],
    durationMs: 0
  })
  assert.equal(missing.status, 'error')
  assert.equal(missing.files[0].verdict, 'skipped')
  assert.equal(missing.files[1].verdict, 'error')
  assert.equal(missing.files[1].cases[0].verdict, 'error')
})

test('SDK重复文件目标合并选中下标，不能让进度的文件metadata被最后一个目标覆盖', async t => {
  const { fileA, fileB: _fileB } = await realSources(t)
  const expanded = await expandTestGroups(
    { interfacePath: 'unused', test: { cases: [planned(fileA, [0, 2])] } },
    {
      targets: [
        { ...metadata(fileA, [0, 2]), selected: [0] },
        { ...metadata(fileA, [0, 2]), selected: [2] }
      ]
    }
  )
  assert.equal(expanded.files.length, 1)
  assert.deepEqual(
    expanded.files[0].cases.map(testCase => testCase.index),
    [0, 2]
  )
  const report = buildTestRunResult({
    files: expanded.files,
    groups: [group([result(fileA), result(fileA, 2)])],
    plannedGroups: expanded.groups,
    durationMs: 1
  })
  assert.equal(report.status, 'passed')
  assert.deepEqual(report.files[0].selectedCases, [0, 2])
})

test('普通报告每次平台验证只在files出现一次，正常、错误和空报告省略无来源字段', () => {
  const results = [result(fileA), result(fileA, 2), result(fileA)]
  for (const [index, item] of results.entries()) {
    item.imagePath = path.resolve(`images/platform-${index}.png`)
  }
  const report = buildTestRunResult({
    files: [metadata(fileA, [0, 2])],
    groups: [group(results.slice(0, 2)), group(results.slice(2), 'C2')],
    durationMs: 123
  })
  assertPublicResult(report)
  assert.equal(report.status, 'passed')
  assert.equal(Object.hasOwn(report, 'casesWithoutSource'), false)
  const published = report.files.flatMap(file =>
    file.cases.flatMap(item => item.platforms.map(platform => platform.result))
  )
  assert.equal(published.length, results.length)
  for (const item of results) {
    assert.equal(published.filter(published => published === item).length, 1)
    assert.equal(JSON.stringify(report).split(JSON.stringify(item.imagePath)).length - 1, 1)
  }
  for (const empty of [
    buildTestRunResult({ files: [], groups: [], durationMs: 0 }),
    buildTestRunResult({ files: [], groups: [], durationMs: 0, errorCode: 'test-config-missing' })
  ]) {
    assertPublicResult(empty)
    assert.equal(Object.hasOwn(empty, 'casesWithoutSource'), false)
  }
})

for (const verdict of ['pass', 'fail', 'error', 'skipped'] as const) {
  for (const origin of [
    undefined,
    null,
    { file: 'relative.json', case: 0 },
    { file: fileA, case: -1 },
    { file: fileA, case: 0.5 }
  ]) {
    test(`内部${verdict}结果含无效来源${JSON.stringify(origin)}时拒绝，已有文件结果仍只有一份`, () => {
      const invalid = { ...result(fileA, 0, verdict), origin } as unknown as TestCaseRunResult
      const report = buildTestRunResult({
        files: [metadata()],
        groups: [group([result(), invalid])],
        durationMs: 0
      })
      assertPublicResult(report)
      assert.equal(report.status, 'error')
      assert.equal(report.errorCode, 'test-source-invalid')
      assert.equal(report.files[0].cases[0].platforms.length, 1)
    })
  }
}

for (const verdict of ['pass', 'fail', 'error', 'skipped'] as const) {
  for (const origin of [
    { file: fileB, case: 0 },
    { file: fileA, case: 2 }
  ]) {
    test(`有来源${verdict}无法匹配元数据${origin.file === fileB ? '文件' : '下标'}时明确报错`, () => {
      const orphan = { ...result(fileA, 0, verdict), origin }
      const report = buildTestRunResult({
        files: [metadata()],
        groups: [group([result(), orphan])],
        durationMs: 0
      })
      assertPublicResult(report)
      assert.equal(report.status, 'error')
      assert.equal(report.errorCode, 'test-source-invalid')
      assert.ok(report.reason?.includes(origin.file))
      assert.ok(report.reason?.includes(`[${origin.case}]`))
      assert.equal(report.files[0].verdict, 'pass')
      assert.equal(Object.hasOwn(report, 'casesWithoutSource'), false)
    })
  }
}

test('只有孤立来源结果时不假pass或empty，有坏文件时仍优先报告文件错误', () => {
  const orphan = group([result()])
  const noMetadata = buildTestRunResult({ files: [], groups: [orphan], durationMs: 0 })
  assert.equal(noMetadata.status, 'error')
  assert.equal(noMetadata.errorCode, 'test-source-invalid')
  assert.deepEqual(noMetadata.files, [])
  assert.equal(Object.hasOwn(noMetadata, 'casesWithoutSource'), false)
  const bad = buildTestRunResult({
    files: [{ ...metadata(fileA, []), error: '原文件解析失败' }],
    groups: [orphan],
    durationMs: 0
  })
  assert.equal(bad.status, 'error')
  assert.equal(bad.errorCode, 'test-file-error')
  assert.equal(bad.files[0].error, '原文件解析失败')
})

test('公开body不含groups/schemaVersion/casesWithoutSource，算法detail允许保留同名键', () => {
  const item = result()
  const detail = {
    hit: true,
    groups: ['算法内部数据'],
    schemaVersion: 7,
    casesWithoutSource: [1]
  } as unknown as maa.RecoDetail
  item.checks[0].detail = detail
  const report = buildTestRunResult({ files: [metadata()], groups: [group([item])], durationMs: 0 })
  assertPublicResult(report)
  assert.equal(report.files[0].cases[0].platforms[0].result.checks[0].detail, detail)
  assert.throws(() => assertPublicResult(Object.defineProperty({}, 'groups', { get: () => [] })))
  assert.throws(() => assertPublicResult({ files: [], schemaVersion: 1 }))
  assert.throws(() => assertPublicResult({ files: [], casesWithoutSource: [] }))
})

test('SDK重复文件目标去重仍保留任何一个目标的文件错误', async t => {
  const { fileA, fileB: _fileB } = await realSources(t)
  const expanded = await expandTestGroups(
    { interfacePath: 'unused', test: { cases: [planned(fileA)] } },
    {
      targets: [metadata(fileA), { ...metadata(fileA, []), error: 'bad file' }]
    }
  )
  assert.equal(expanded.files.length, 1)
  const report = buildTestRunResult({
    files: expanded.files,
    groups: [group([result()])],
    plannedGroups: expanded.groups,
    durationMs: 1
  })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-file-error')
  assert.equal(report.files[0].error, 'bad file')
})

test('同文件的断言失败优先于文件错误，整批仍优先报告test-file-error', () => {
  const report = buildTestRunResult({
    files: [{ ...metadata(), error: 'file metadata error' }],
    groups: [group([result(fileA, 0, 'fail')])],
    durationMs: 0
  })
  assertPublicResult(report)
  assert.equal(report.files[0].verdict, 'fail')
  assert.equal(report.files[0].error, 'file metadata error')
  assert.equal(report.files[0].cases[0].verdict, 'fail')
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'test-file-error')
})
