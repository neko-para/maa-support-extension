import * as path from 'node:path'

import type { TestCases } from '../types/config'
import { pathKey, samePath } from '../utils/paths.ts'
import { normalizeHits, readTestFile } from './files.ts'
import type { ListedFile, TestRunOptions } from './types'

export type RunTarget = ListedFile & {
  /** 原始下标；不填表示整个文件。 */
  selected?: number[]
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
      const file = pathKey(origin.file)
      return selected.has(file) && (selected.get(file)?.has(origin.case) ?? true)
    })
    if (cases.length > 0) {
      kept.push({ ...group, cases })
    }
  }
  return { groups: kept }
}

export class TestSelectionError extends Error {
  readonly errorCode = 'invalid-case-selection'
}

/** 坏文件保留为独立目标；参数选择错误才抛错，不阻止其它文件运行。 */
export async function buildRunTargets(
  files: readonly string[],
  caseIndices?: number | readonly number[] | null,
  cwd: string = process.cwd()
): Promise<RunTarget[]> {
  const paths = new Map<string, string>()
  for (const file of files) {
    const absolute = path.resolve(cwd, file)
    const key = pathKey(absolute)
    if (!paths.has(key)) paths.set(key, absolute)
  }
  const selected =
    caseIndices === null ||
    caseIndices === undefined ||
    (Array.isArray(caseIndices) && caseIndices.length === 0)
      ? undefined
      : [...new Set(typeof caseIndices === 'number' ? [caseIndices] : caseIndices)]
  if (selected !== undefined) {
    if (paths.size !== 1) {
      throw new TestSelectionError('--case 只能和单个 --file 一起用')
    }
    if (
      selected.length === 0 ||
      selected.some(index => !Number.isSafeInteger(index) || index < 0)
    ) {
      throw new TestSelectionError('--case 必须是从 0 开始的用例下标')
    }
  }
  const targets: RunTarget[] = []
  for (const file of paths.values()) {
    const { listed } = await readTestFile(file)
    if (
      !listed.error &&
      selected?.some(index => !listed.cases.some(item => item.index === index))
    ) {
      throw new TestSelectionError(
        `--case ${selected.join(', ')} 超出范围：这个文件共 ${listed.cases.length} 条用例`
      )
    }
    targets.push({ ...listed, ...(selected ? { selected } : {}) })
  }
  return targets
}

export function filterGroupsByPlatform(
  groups: readonly TestCases[],
  options: Pick<TestRunOptions, 'controllers' | 'resources'> = {}
): TestCases[] {
  const inList = (list: readonly string[] | undefined, value: string) =>
    !list || list.length === 0 || list.includes(value)
  return groups.filter(
    group =>
      group.cases.length > 0 &&
      inList(options.controllers, group.configs.controller) &&
      inList(options.resources, group.configs.resource)
  )
}

function selectedFile(target: RunTarget, groups?: readonly TestCases[]): ListedFile {
  const { selected, ...file } = target
  const actual = groups
    ? new Set(
        groups.flatMap(group =>
          group.cases.flatMap(testCase =>
            samePath(testCase.origin.file, target.file) ? [testCase.origin.case] : []
          )
        )
      )
    : undefined
  return {
    ...file,
    file: path.resolve(target.file),
    cases: target.cases.filter(testCase =>
      selected !== undefined
        ? selected.includes(testCase.index)
        : actual === undefined || actual.has(testCase.index)
    )
  }
}

export function filesForTargets(
  targets: readonly RunTarget[],
  groups?: readonly TestCases[]
): ListedFile[] {
  const files = new Map<string, ListedFile>()
  for (const target of targets) {
    const listed = selectedFile(target, groups)
    const key = pathKey(listed.file)
    const previous = files.get(key)
    if (!previous) {
      files.set(key, listed)
      continue
    }
    const cases = new Map(previous.cases.map(testCase => [testCase.index, testCase]))
    for (const testCase of listed.cases) {
      if (!cases.has(testCase.index)) cases.set(testCase.index, testCase)
    }
    previous.cases = [...cases.values()].sort((left, right) => left.index - right.index)
    if (listed.error && !previous.error) previous.error = listed.error
  }
  return [...files.values()]
}
