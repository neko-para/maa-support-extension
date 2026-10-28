import * as path from 'node:path'

import type { FullConfig, TestCases } from '../types/config'
import { pathKey } from '../utils/paths.ts'
import { captureTestFileReads, isCaseOrigin, readTestFile } from './files.ts'
import {
  TestSourceError,
  filesForTargets,
  filterGroupsByPlatform,
  filterGroupsForFiles,
  withGroupNodes
} from './selection.ts'
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

async function filesForGroups(
  groups: readonly TestCases[],
  reads: Map<string, ListedFile>
): Promise<ListedFile[]> {
  const indexes = new Map<string, { file: string; selected: Set<number> }>()
  for (const group of groups) {
    for (const testCase of group.cases) {
      const origin = testCase.origin
      if (!isCaseOrigin(origin)) {
        continue
      }
      const key = pathKey(origin.file)
      const entry = indexes.get(key) ?? {
        file: path.resolve(origin.file),
        selected: new Set<number>()
      }
      entry.selected.add(origin.case)
      indexes.set(key, entry)
    }
  }
  const files: ListedFile[] = []
  for (const [key, { file, selected }] of indexes) {
    const listed = reads.get(key) ?? (await readTestFile(file)).listed
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
    if (listed.error && !indexes.has(pathKey(listed.file))) {
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
      ? filesForTargets(options.targets)
      : [...reads.values()].filter(file => file.error)
    throw loaded.error
  }
  const groups = filterGroupsByPlatform(loaded.groups, options)
  if (!options.targets || options.targets.length === 0) {
    return { groups, files: await filesForGroups(groups, reads) }
  }
  const files = filesForTargets(options.targets, groups)
  try {
    return { ...filterGroupsForFiles(groups, options.targets), files }
  } catch (error) {
    if (error instanceof TestSourceError) {
      error.files = files
    }
    throw error
  }
}
