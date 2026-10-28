import * as path from 'node:path'

import { readTestFile } from '../utils/tools.ts'
import type { RunTarget } from './filter'

export class TestSelectionError extends Error {
  readonly errorCode = 'invalid-case-selection'
}

/** 坏文件保留为独立目标；参数选择错误才抛错，不阻止其它文件运行。 */
export async function buildRunTargets(
  files: readonly string[],
  caseIndices?: number | readonly number[] | null,
  cwd: string = process.cwd()
): Promise<RunTarget[]> {
  const paths = [...new Set(files.map(file => path.resolve(cwd, file)))]
  const selected =
    caseIndices === null ||
    caseIndices === undefined ||
    (Array.isArray(caseIndices) && caseIndices.length === 0)
      ? undefined
      : [...new Set(typeof caseIndices === 'number' ? [caseIndices] : caseIndices)]
  if (selected !== undefined) {
    if (paths.length !== 1) {
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
  for (const file of paths) {
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
