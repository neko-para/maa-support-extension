import * as path from 'node:path'

import type { FullConfig, TestCases } from '../types/config'
import { captureTestFileReads, isCaseOrigin, readTestFile } from '../utils/tools.ts'
import { TestSourceError, filterGroupsForFiles, withGroupNodes } from './filter.ts'
import type { ListedFile, TestRunOptions } from './types'

export class TestPlanError extends Error {
  readonly errorCode: string
  files?: ListedFile[]

  constructor(errorCode: string, message: string) {
    super(message)
    this.errorCode = errorCode
  }
}

function validateGroup(value: unknown): TestCases {
  const group = value as TestCases | null
  if (
    !group ||
    typeof group !== 'object' ||
    !group.configs ||
    typeof group.configs.controller !== 'string' ||
    !group.configs.controller ||
    typeof group.configs.resource !== 'string' ||
    !group.configs.resource ||
    !Array.isArray(group.cases) ||
    group.cases.some(
      testCase =>
        !testCase ||
        typeof testCase.image !== 'string' ||
        !testCase.image ||
        !Array.isArray(testCase.hits)
    ) ||
    (group.nodes !== undefined &&
      (!Array.isArray(group.nodes) || group.nodes.some(node => typeof node !== 'string' || !node)))
  ) {
    throw new TestPlanError(
      'invalid-test-config',
      'test.cases 必须返回已展开的测试组，包含 controller、resource 和合法 cases'
    )
  }
  if (
    group.cases.some(testCase => testCase.origin !== undefined && !isCaseOrigin(testCase.origin))
  ) {
    throw new TestPlanError(
      'test-source-invalid',
      '用例 origin 必须包含绝对文件路径和从 0 开始的原始下标'
    )
  }
  return withGroupNodes(group)
}

function selectedFile(
  target: NonNullable<TestRunOptions['targets']>[number],
  groups?: readonly TestCases[]
): ListedFile {
  const { selected, ...file } = target
  const actual = groups
    ? new Set(
        groups.flatMap(group =>
          group.cases.flatMap(testCase =>
            testCase.origin && path.resolve(testCase.origin.file) === path.resolve(target.file)
              ? [testCase.origin.case]
              : []
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

async function filesForGroups(
  groups: readonly TestCases[],
  reads: Map<string, ListedFile>
): Promise<ListedFile[]> {
  const indexes = new Map<string, Set<number>>()
  for (const group of groups) {
    for (const testCase of group.cases) {
      const origin = testCase.origin
      if (!isCaseOrigin(origin)) {
        continue
      }
      const file = path.resolve(origin.file)
      const selected = indexes.get(file) ?? new Set<number>()
      selected.add(origin.case)
      indexes.set(file, selected)
    }
  }
  const files: ListedFile[] = []
  for (const [file, selected] of indexes) {
    const listed = reads.get(file) ?? (await readTestFile(file)).listed
    const missing = [...selected].filter(index => !listed.cases.some(item => item.index === index))
    files.push({
      ...listed,
      ...(missing.length > 0 && !listed.error
        ? { error: `来源用例下标不存在：${missing.join(', ')}` }
        : {}),
      cases: listed.cases.filter(testCase => selected.has(testCase.index))
    })
  }
  for (const listed of reads.values()) {
    if (listed.error && !indexes.has(listed.file)) {
      files.push(listed)
    }
  }
  return files.sort((a, b) => a.file.localeCompare(b.file))
}

/** 配置函数只执行一次，收集和运行共用加载、节点固定和来源筛选。 */
export async function expandTestGroups(
  cfg: FullConfig,
  options: TestRunOptions = {}
): Promise<{ groups: TestCases[]; files: ListedFile[] }> {
  const { value: loaded, files: reads } = await captureTestFileReads(async () => {
    try {
      const source = cfg.test?.cases
      const resolved = typeof source === 'function' ? await source() : source
      if (!Array.isArray(resolved)) {
        throw new TestPlanError(
          'invalid-test-config',
          'test.cases 必须是测试组数组或返回该数组的函数'
        )
      }
      return { groups: resolved.map(validateGroup) }
    } catch (error) {
      return {
        groups: [],
        error:
          error instanceof TestPlanError
            ? error
            : new TestPlanError(
                'test-cases-load-failed',
                error instanceof Error ? error.message : String(error)
              )
      }
    }
  })
  if (loaded.error) {
    loaded.error.files = options.targets?.length
      ? options.targets.map(target => selectedFile(target))
      : [...reads.values()].filter(file => file.error)
    throw loaded.error
  }
  const all = loaded.groups
  const inList = (list: readonly string[] | undefined, value: string) =>
    !list || list.length === 0 || list.includes(value)
  const groups = all.filter(
    group =>
      group.cases.length > 0 &&
      inList(options.controllers, group.configs.controller) &&
      inList(options.resources, group.configs.resource)
  )
  if (!options.targets || options.targets.length === 0) {
    return { groups, files: await filesForGroups(groups, reads) }
  }
  const files = options.targets.map(target => selectedFile(target, groups))
  try {
    return { ...filterGroupsForFiles(groups, options.targets), files }
  } catch (error) {
    if (error instanceof TestSourceError) {
      error.files = files
    }
    throw error
  }
}
