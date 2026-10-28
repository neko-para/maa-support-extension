import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import { buildGroupRunResult } from '../src/test/evaluate.ts'
import { expandTestGroups } from '../src/test/plan.ts'
import { buildTestRunResult } from '../src/test/report.ts'
import type { ListedFile, TestCaseRunResult, TestGroupRunResult } from '../src/test/types.ts'
import type { TestCases } from '../src/types/config.ts'
import { assertNoSchemaVersion } from './assertions.ts'

const fileA = path.resolve('source-tests/a.json')
const fileB = path.resolve('source-tests/b.json')

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
  assertNoSchemaVersion(report)
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

test('全部缺图或没有任何有效检查都不能判通过，包括无来源API组', () => {
  const skipped = buildTestRunResult({
    files: [metadata()],
    groups: [group([result(fileA, 0, 'skipped')])],
    durationMs: 0
  })
  assert.equal(skipped.status, 'error')
  assert.equal(skipped.files[0].verdict, 'error')
  const noChecks = { ...result(), checks: [], origin: undefined }
  const report = buildTestRunResult({ files: [], groups: [group([noChecks])], durationMs: 0 })
  assert.equal(report.status, 'error')
  assert.equal(report.errorCode, 'no-tests-verified')
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
  assert.equal(report.groups[0].verdict, 'fail')
  assert.equal(report.status, 'error')
})

test('没有文件来源的API测试只按groups真实结果汇总，files为空不等于empty', () => {
  const sourceLess = { ...result(), origin: undefined }
  assert.equal(
    buildTestRunResult({ files: [], groups: [group([sourceLess])], durationMs: 0 }).status,
    'passed'
  )
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
    test(`${axis}过滤掉整个文件时跳过空文件，保留另一个文件的${verdict}`, async () => {
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

test('全部文件被平台过滤时仍为empty，空文件本身记跳过而非通过', async () => {
  const expanded = await expandTestGroups(
    { interfacePath: 'unused', test: { cases: [planned()] } },
    {
      targets: [metadata()],
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

test('SDK重复文件目标合并选中下标，不能让进度的文件metadata被最后一个目标覆盖', async () => {
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

test('SDK重复文件目标去重仍保留任何一个目标的文件错误', async () => {
  const expanded = await expandTestGroups(
    { interfacePath: 'unused', test: { cases: [planned()] } },
    {
      targets: [metadata(), { ...metadata(fileA, []), error: 'bad file' }]
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
