import * as path from 'node:path'

import type { TestCases } from '../types/config'
import { samePath } from '../utils/paths.ts'
import type {
  CaseVerdict,
  ListedCase,
  ListedFile,
  TestCaseRunResult,
  TestFileCaseResult,
  TestFileRunResult,
  TestGroupRunResult,
  TestRunResult
} from './types'

type RunReportInput = {
  groups: readonly TestGroupRunResult[]
  files: readonly ListedFile[]
  durationMs: number
  errorCode?: string
  reason?: string
  plannedGroups?: readonly TestCases[]
}

function wasVerified(result: TestCaseRunResult) {
  return (
    (result.verdict === 'pass' || result.verdict === 'fail') &&
    result.checks.length > 0 &&
    result.checks.some(check => check.reason !== 'no-result')
  )
}

function caseVerdict(platforms: TestFileCaseResult['platforms']): CaseVerdict {
  if (platforms.some(platform => platform.result.verdict === 'fail')) {
    return 'fail'
  }
  if (platforms.length === 0 || platforms.some(platform => platform.result.verdict === 'error')) {
    return 'error'
  }
  if (platforms.some(platform => platform.result.verdict === 'skipped')) {
    return 'skipped'
  }
  return platforms.some(platform => wasVerified(platform.result)) ? 'pass' : 'error'
}

function summarizeCase(
  file: ListedFile,
  testCase: ListedCase,
  input: RunReportInput
): TestFileCaseResult {
  const platforms: TestFileCaseResult['platforms'] = []
  for (const group of input.groups) {
    for (const result of group.cases) {
      if (
        result.origin &&
        samePath(result.origin.file, file.file) &&
        result.origin.case === testCase.index
      ) {
        platforms.push({ controller: group.controller, resource: group.resource, result })
      }
    }
  }
  const hasResults = platforms.length > 0
  const completedError = platforms.find(platform => platform.result.error)?.result.error
  const hasPlannedCases = input.plannedGroups?.some(group => group.cases.length > 0) ?? false
  const planned = (input.plannedGroups ?? []).filter(group =>
    group.cases.some(
      item =>
        item.origin && samePath(item.origin.file, file.file) && item.origin.case === testCase.index
    )
  )
  const missingCode =
    input.errorCode && (planned.length > 0 || (!hasPlannedCases && input.groups.length === 0))
      ? input.errorCode
      : input.groups.length === 0 && !hasPlannedCases
        ? 'no-tests-matched'
        : 'no-result'
  let missingPlatform = false
  for (const group of planned) {
    if (
      platforms.some(
        platform =>
          platform.controller === group.configs.controller &&
          platform.resource === group.configs.resource
      )
    ) {
      continue
    }
    missingPlatform = true
    platforms.push({
      controller: group.configs.controller,
      resource: group.configs.resource,
      result: {
        image: testCase.image,
        imagePath: '',
        origin: { file: path.resolve(file.file), case: testCase.index },
        verdict: 'error',
        checks: [],
        durationMs: 0,
        error: missingCode
      }
    })
  }
  const verdict = caseVerdict(platforms)
  // 已完成检查的本地原因不能被另一文件稍后的运行错误覆盖。
  const reason =
    verdict === 'error'
      ? hasResults && !missingPlatform
        ? (completedError ?? 'no-result')
        : planned.length === 0 && hasPlannedCases
          ? 'no-result'
          : (input.reason ?? completedError ?? missingCode)
      : verdict === 'skipped'
        ? 'missing-image'
        : undefined
  return {
    ...testCase,
    verdict,
    durationMs: platforms.reduce((sum, platform) => sum + platform.result.durationMs, 0),
    ...(reason ? { reason } : {}),
    platforms
  }
}

function summarizeFile(file: ListedFile, input: RunReportInput): TestFileRunResult {
  if (!file.error && file.cases.length === 0) {
    return {
      ...file,
      file: path.resolve(file.file),
      selectedCases: [],
      verdict: 'skipped',
      reason: 'no-cases-selected',
      cases: []
    }
  }
  const cases = file.cases.map(testCase => summarizeCase(file, testCase, input))
  const failed = cases.some(testCase => testCase.verdict === 'fail')
  const error = file.error || cases.some(testCase => testCase.verdict === 'error')
  const verified = cases.some(testCase =>
    testCase.platforms.some(platform => wasVerified(platform.result))
  )
  const verdict = failed ? 'fail' : error || !verified ? 'error' : 'pass'
  const reason = file.error
    ? file.error
    : verdict === 'error'
      ? (cases.find(testCase => testCase.verdict === 'error')?.reason ?? 'no-tests-verified')
      : verdict === 'pass' && cases.some(testCase => testCase.verdict === 'skipped')
        ? 'some-platforms-skipped'
        : undefined
  return {
    ...file,
    file: path.resolve(file.file),
    selectedCases: file.cases.map(testCase => testCase.index),
    verdict,
    ...(reason ? { reason } : {}),
    cases
  }
}

/** 文件与顶层结论在框架内统一生成，调用方只需检查完整性并转换显示。 */
export function buildTestRunResult(input: RunReportInput): TestRunResult {
  const groups = [...input.groups]
  const files = input.files.map(file => summarizeFile(file, input))
  const base = { groups, files, durationMs: input.durationMs }
  if (input.errorCode && input.errorCode !== 'no-tests-matched') {
    return {
      ...base,
      status: 'error',
      errorCode: input.errorCode,
      reason: input.reason ?? input.errorCode
    }
  }
  if (
    groups.length === 0 &&
    !input.plannedGroups?.some(group => group.cases.length > 0) &&
    !input.files.some(file => file.error)
  ) {
    return {
      ...base,
      status: 'empty',
      errorCode: 'no-tests-matched',
      reason: '没有匹配到测试组，请检查配置、来源和过滤条件'
    }
  }
  if (
    input.files.some(file => file.error) ||
    files.some(
      file =>
        file.verdict === 'error' ||
        file.cases.some(testCase =>
          testCase.platforms.some(platform => platform.result.verdict === 'error')
        )
    ) ||
    groups.some(
      group =>
        group.verdict === 'error' || group.cases.some(testCase => testCase.verdict === 'error')
    )
  ) {
    return {
      ...base,
      status: 'error',
      errorCode: input.files.some(file => file.error)
        ? 'test-file-error'
        : 'test-verification-error',
      reason: files.find(file => file.verdict === 'error')?.reason ?? '部分测试组未完成验证'
    }
  }
  if (
    files.some(file => file.verdict === 'fail') ||
    groups.some(group => group.verdict === 'fail')
  ) {
    return { ...base, status: 'failed' }
  }
  if (!groups.some(group => group.cases.some(wasVerified))) {
    return {
      ...base,
      status: 'error',
      errorCode: 'no-tests-verified',
      reason: '没有任何用例完成节点检查，不能判定为通过'
    }
  }
  return { ...base, status: 'passed' }
}
