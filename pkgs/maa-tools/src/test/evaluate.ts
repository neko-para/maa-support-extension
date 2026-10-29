import type { TestCases } from '../types/config'
import type {
  CaseCheckResult,
  CaseVerdict,
  RecoResult,
  TestCaseRunResult,
  TestGroupRunResult
} from './types'

type TestCase = TestCases['cases'][number]

function checkRect(expect: maa.Rect, real: maa.Rect) {
  return (
    real[0] >= expect[0] &&
    real[1] >= expect[1] &&
    real[0] + real[2] <= expect[0] + expect[2] &&
    real[1] + real[3] <= expect[1] + expect[3]
  )
}

/** 用完整节点集合判定用例；没有返回结果的节点也必须留下失败检查。 */
export function evaluateCase(
  testCase: TestCase,
  imagePath: string,
  results: readonly RecoResult[],
  groupNodes: readonly string[]
): TestCaseRunResult {
  const resultsByNode = new Map(
    results.filter(result => result.imagePath === imagePath).map(result => [result.node, result])
  )
  const hits = new Map(testCase.hits.map(hit => [typeof hit === 'string' ? hit : hit.node, hit]))
  const nodes = new Set([...groupNodes, ...hits.keys()])
  const checks: CaseCheckResult[] = []

  for (const node of nodes) {
    const hitCfg = hits.get(node)
    const expected = hitCfg === undefined ? 'miss' : 'hit'
    const expectedBox = typeof hitCfg === 'object' ? hitCfg.box : undefined
    const reco = resultsByNode.get(node)
    const base = {
      node,
      expected,
      expectedBox,
      hit: reco?.hit ?? false,
      detail: reco?.detail ?? null
    } satisfies Omit<CaseCheckResult, 'ok'>

    if (!reco) {
      checks.push({ ...base, ok: false, reason: 'no-result' })
    } else if (!reco.detail) {
      checks.push({ ...base, ok: false, reason: 'missing-detail' })
    } else if (expected === 'hit' && !reco.hit) {
      checks.push({ ...base, ok: false, reason: 'should-hit' })
    } else if (expected === 'miss' && reco.hit) {
      checks.push({ ...base, ok: false, reason: 'should-miss' })
    } else if (
      expectedBox !== undefined &&
      (!reco.detail.box || !checkRect(expectedBox, reco.detail.box))
    ) {
      checks.push({ ...base, ok: false, reason: 'box-mismatch' })
    } else {
      checks.push({ ...base, ok: true })
    }
  }

  const error =
    nodes.size === 0
      ? 'no nodes to check'
      : checks.every(check => check.reason === 'no-result')
        ? 'no reco result for this image'
        : undefined

  return {
    image: testCase.image,
    imagePath,
    origin: testCase.origin,
    verdict: nodes.size === 0 ? 'error' : checks.some(check => !check.ok) ? 'fail' : 'pass',
    checks,
    durationMs: 0,
    ...(error ? { error } : {})
  }
}

export function groupNameOf(testCases: Pick<TestCases, 'configs'>): string {
  return testCases.configs.name ?? `${testCases.configs.controller}:${testCases.configs.resource}`
}

export function groupVerdict(cases: readonly TestCaseRunResult[]): CaseVerdict {
  if (cases.some(item => item.verdict === 'fail')) {
    return 'fail'
  }
  if (cases.some(item => item.verdict === 'error')) {
    return 'error'
  }
  if (cases.some(item => item.verdict === 'pass')) {
    return 'pass'
  }
  return cases.length === 0 ? 'error' : 'skipped'
}

export function buildGroupRunResult(
  testCases: TestCases,
  cases: TestCaseRunResult[]
): TestGroupRunResult {
  return {
    name: groupNameOf(testCases),
    ...(testCases.source ? { source: testCases.source } : {}),
    controller: testCases.configs.controller,
    resource: testCases.configs.resource,
    verdict: groupVerdict(cases),
    cases,
    durationMs: cases.reduce((sum, item) => sum + item.durationMs, 0)
  }
}
