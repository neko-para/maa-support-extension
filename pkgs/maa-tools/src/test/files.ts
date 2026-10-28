import { type Node, type ParseError, parse, parseTree } from 'jsonc-parser'
import { AsyncLocalStorage } from 'node:async_hooks'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { CaseOrigin, TestCases } from '../types/config'
import { pathKey } from '../utils/paths.ts'
import type { ListedCase, ListedFile, ListedFileBody } from './types'

const testFileReads = new AsyncLocalStorage<Map<string, ListedFile>>()

export function isCaseOrigin(value: unknown): value is CaseOrigin {
  const origin = value as Partial<CaseOrigin> | null
  return !!(
    origin &&
    typeof origin.file === 'string' &&
    path.isAbsolute(origin.file) &&
    typeof origin.case === 'number' &&
    Number.isSafeInteger(origin.case) &&
    origin.case >= 0
  )
}

export function hitNodeName(hit: unknown): string | null {
  if (typeof hit === 'string') {
    return hit
  }
  if (hit && typeof hit === 'object' && typeof (hit as { node?: unknown }).node === 'string') {
    return (hit as { node: string }).node
  }
  return null
}

export function normalizeName(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function normalizeHits(hits: unknown): string[] {
  if (!Array.isArray(hits)) {
    return []
  }
  return [...new Set(hits.map(hitNodeName).filter((node): node is string => node !== null))]
}

export function normalizeStringList(value: unknown): string[] | null {
  const items = typeof value === 'string' ? [value] : Array.isArray(value) ? value : null
  if (!items || items.length === 0 || items.some(item => typeof item !== 'string' || !item)) {
    return null
  }
  return [...new Set(items)]
}

function errorBody(error: string): ListedFileBody {
  return { error, controllers: [], resources: [], cases: [] }
}

function findCaseNodes(tree: Node | undefined, count: number): Node[] | null {
  if (!tree || tree.type !== 'object') {
    return null
  }
  let casesNode: Node | undefined
  for (const property of tree.children ?? []) {
    if (property.type === 'property' && property.children?.[0]?.value === 'cases') {
      casesNode = property.children[1]
    }
  }
  const nodes = casesNode?.type === 'array' ? (casesNode.children ?? []) : []
  return nodes.length === count ? nodes : null
}

/** 加载和收集使用同一次解析及形状校验，避免两条路径接受不同输入。 */
export function parseTestContent(content: string): {
  body: ListedFileBody
  testCases: TestCases | null
} {
  const fail = (error: string) => ({ body: errorBody(error), testCases: null })
  const errors: ParseError[] = []
  const value = parse(content, errors) as unknown
  const tree = parseTree(content, errors)
  if (errors.length > 0) {
    return fail(`JSON 解析失败：偏移 ${errors[0].offset}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('顶层必须是对象（要有 configs 和 cases）')
  }
  const root = value as Record<string, unknown>
  if (!root.configs || typeof root.configs !== 'object' || Array.isArray(root.configs)) {
    return fail('缺少 configs 对象')
  }
  const configs = root.configs as Record<string, unknown>
  const controllers = normalizeStringList(configs.controller)
  if (!controllers) {
    return fail('configs.controller 必须是非空字符串或字符串数组')
  }
  const resources = normalizeStringList(configs.resource)
  if (!resources) {
    return fail('configs.resource 必须是非空字符串或字符串数组')
  }
  if (!Array.isArray(root.cases)) {
    return fail('缺少 cases 数组')
  }
  if (root.cases.length === 0) {
    return fail('cases 是空数组，没有可运行用例')
  }
  const caseNodes = findCaseNodes(tree, root.cases.length)
  const listedCases: ListedCase[] = []
  for (const [index, item] of root.cases.entries()) {
    const itemObj = item && typeof item === 'object' && !Array.isArray(item) ? item : {}
    if (typeof itemObj.image !== 'string' || !itemObj.image) {
      return fail(`第 ${index + 1} 个用例缺少 image（截图文件名）`)
    }
    if (!Array.isArray(itemObj.hits)) {
      return fail(`第 ${index + 1} 个用例缺少 hits 数组（负例请写空数组）`)
    }
    const node = caseNodes?.[index]
    if (!node) {
      return fail('JSON 解析失败：偏移 0')
    }
    listedCases.push({
      index,
      name: normalizeName(itemObj.name),
      image: itemObj.image,
      hits: normalizeHits(itemObj.hits),
      start: node.offset,
      end: node.offset + node.length
    })
  }
  return {
    body: { name: normalizeName(configs.name), controllers, resources, cases: listedCases },
    testCases: root as unknown as TestCases
  }
}

export async function readTestFile(file: string): Promise<{
  listed: ListedFile
  testCases: TestCases | null
}> {
  const absolute = path.resolve(file)
  let parsed: ReturnType<typeof parseTestContent>
  try {
    parsed = parseTestContent(await fs.readFile(absolute, 'utf8'))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    parsed = {
      body: errorBody(
        code === 'ENOENT' || code === 'ENOTDIR'
          ? '找不到测试文件'
          : `无法读取测试文件：${error instanceof Error ? error.message : String(error)}`
      ),
      testCases: null
    }
  }
  const listed = { file: absolute, ...parsed.body }
  testFileReads.getStore()?.set(pathKey(absolute), listed)
  const testCases = parsed.testCases
    ? {
        ...parsed.testCases,
        source: absolute,
        cases: parsed.testCases.cases.map((testCase, index) => ({
          ...testCase,
          hits: testCase.hits.filter(hit => hitNodeName(hit) !== null),
          origin: { file: absolute, case: index }
        }))
      }
    : null
  return { listed, testCases }
}

export async function captureTestFileReads<T>(run: () => Promise<T>) {
  const files = testFileReads.getStore() ?? new Map<string, ListedFile>()
  const value = await testFileReads.run(files, run)
  return { value, files }
}

export async function loadTestCases(file: string) {
  return (await readTestFile(file)).testCases
}

export async function loadAllTestCases(
  folder: string,
  pattern: string
): Promise<[testCases: TestCases[], failFiles: string[]]> {
  const results: TestCases[] = []
  const fails: string[] = []
  for await (const file of fs.glob(pattern, { cwd: folder })) {
    const testCases = await loadTestCases(path.resolve(folder, file))
    if (testCases) {
      results.push(testCases)
    } else {
      fails.push(file)
    }
  }
  return [results, fails]
}
