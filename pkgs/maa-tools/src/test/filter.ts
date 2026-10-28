import type { TestCases } from '../types/config'
import { isCaseOrigin, normalizeHits, pathKey } from '../utils/tools.ts'
import type { ListedFile } from './types'

export type { CaseOrigin } from '../types/config'
export { hitNodeName } from '../utils/tools.ts'

export type RunTarget = ListedFile & {
  /** 原始下标；不填表示整个文件。 */
  selected?: number[]
}

export class TestSourceError extends Error {
  readonly errorCode = 'test-source-missing'
  files?: ListedFile[]
}

/** 必须在过滤前计算，单条运行也检查同组其它用例声明的节点。 */
export function withGroupNodes(group: TestCases): TestCases {
  return {
    ...group,
    nodes: [
      ...new Set(group.nodes ?? group.cases.flatMap(testCase => normalizeHits(testCase.hits)))
    ]
  }
}

export function filterGroupsForFiles(
  groups: readonly TestCases[],
  targets: readonly RunTarget[]
): { groups: TestCases[] } {
  const selected = new Map<string, Set<number> | undefined>()
  for (const target of targets) {
    if (target.error) {
      continue
    }
    const file = pathKey(target.file)
    if (selected.has(file) && selected.get(file) === undefined) {
      continue
    }
    if (target.selected === undefined) {
      selected.set(file, undefined)
    } else {
      const indexes = selected.get(file) ?? new Set<number>()
      target.selected.forEach(index => indexes.add(index))
      selected.set(file, indexes)
    }
  }
  const kept: TestCases[] = []
  for (const original of groups) {
    const group = withGroupNodes(original)
    const cases = group.cases.filter(testCase => {
      const origin = testCase.origin
      if (!isCaseOrigin(origin)) {
        throw new TestSourceError(
          `测试组 ${group.configs.name ?? `${group.configs.controller}:${group.configs.resource}`} 的用例缺少原始来源；按文件选择需要 loader 保留 loadTestCases 填写的 origin`
        )
      }
      const file = pathKey(origin.file)
      return selected.has(file) && (selected.get(file)?.has(origin.case) ?? true)
    })
    if (cases.length > 0) {
      kept.push({ ...group, cases })
    }
  }
  return { groups: kept }
}
