import { type ParseError, parse } from 'jsonc-parser'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { TestCases } from '../types/config'

export async function loadTestCases(file: string) {
  const content = await fs.readFile(file, 'utf8')
  const errors: ParseError[] = []
  const result = parse(content, errors) as TestCases
  return errors.length > 0 ? null : result
}

export async function loadAllTestCases(
  folder: string,
  pattern: string
): Promise<[testCases: TestCases[], failFiles: string[]]> {
  const results: TestCases[] = []
  const fails: string[] = []
  for await (const file of fs.glob(pattern, { cwd: folder })) {
    const testCases = await loadTestCases(path.resolve(pattern, file))
    if (testCases) {
      results.push(testCases)
    } else {
      fails.push(file)
    }
  }
  return [results, fails]
}
