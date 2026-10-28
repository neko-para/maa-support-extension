import assert from 'node:assert/strict'
import * as path from 'node:path'
import test from 'node:test'

import { buildTestRunResult } from '../src/test/report.ts'
import type { ListedFile, TestCaseRunResult, TestGroupRunResult } from '../src/test/types.ts'
import type { TestCases } from '../src/types/config.ts'

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
  assert.equal(report.schemaVersion, 1)
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
