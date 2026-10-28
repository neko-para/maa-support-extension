import * as path from 'node:path'

import type { FullConfig } from '../types/config'
import { pathKey } from '../utils/paths.ts'
import { isCaseOrigin, readTestFile } from './files.ts'
import { expandTestGroups } from './plan.ts'
import type { TestCollection, TestRunOptions } from './types'

/** 收集实际配置展开出的来源，不初始化 MaaFW，不额外扫描约定目录。 */
export async function collectTests(
  cfg: FullConfig,
  files: readonly string[] = [],
  options: Pick<TestRunOptions, 'controllers' | 'resources'> = {}
): Promise<TestCollection> {
  if (!cfg.test) {
    return {
      files: [],
      errorCode: 'test-config-missing',
      reason: '配置中缺少 test'
    }
  }
  let expanded: Awaited<ReturnType<typeof expandTestGroups>>
  try {
    expanded = await expandTestGroups(cfg, options)
  } catch (error) {
    const failure = error as { errorCode?: string; files?: TestCollection['files'] }
    return {
      files: failure?.files ?? [],
      errorCode: failure?.errorCode ?? 'test-collection-failed',
      reason: error instanceof Error ? error.message : String(error)
    }
  }
  const missingSources = expanded.groups.filter(group =>
    group.cases.some(testCase => !isCaseOrigin(testCase.origin))
  )
  let collected = expanded.files
  if (files.length > 0) {
    const requested = new Map<string, string>()
    for (const file of files) {
      const absolute = path.resolve(cfg.cwd ?? process.cwd(), file)
      const key = pathKey(absolute)
      if (!requested.has(key)) requested.set(key, absolute)
    }
    const actual = new Map(collected.map(file => [pathKey(file.file), file]))
    collected = []
    for (const [key, file] of requested) {
      const listed = actual.get(key)
      if (listed) {
        collected.push(listed)
      } else {
        const { listed: unloaded } = await readTestFile(file)
        collected.push({
          ...unloaded,
          error: unloaded.error ?? '测试文件没有进入当前配置展开的测试组',
          cases: []
        })
      }
    }
  }
  return {
    files: collected,
    ...(missingSources.length > 0
      ? {
          errorCode: 'collection-source-missing',
          reason: `无法列出完整测试文件：${missingSources.length} 个测试组的用例没有原始来源，请让 loader 保留 loadTestCases 填写的 origin`
        }
      : {})
  }
}
