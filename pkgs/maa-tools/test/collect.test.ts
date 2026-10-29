import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { collectTests } from '../src/test/collect.ts'
import { captureTestFileReads, loadAllTestCases, loadTestCases } from '../src/test/files.ts'
import { expandTestGroups } from '../src/test/plan.ts'
import { buildRunTargets } from '../src/test/selection.ts'
import type { FullConfig, TestCases } from '../src/types/config.ts'
import { assertPublicResult } from './assertions.ts'

async function makeTree(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pr92-sources-collect-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content)
  }
  return dir
}

const goodConfigs = '"configs": { "controller": "Win32", "resource": "官服" }'
const goodCases = '"cases": [{ "image": "a.png", "hits": ["节点A"] }]'
const goodFile = `{ ${goodConfigs}, ${goodCases} }`

function configFor(dir: string, cases: NonNullable<FullConfig['test']>['cases']): FullConfig {
  return { cwd: dir, interfacePath: 'not-loaded-during-collection.json', test: { cases } }
}

async function loadFolder(dir: string) {
  return (await loadAllTestCases(path.join(dir, 'custom-cases'), '**/*.json'))[0]
}

test('实际配置决定发现范围：支持自定义目录，保留坏文件，不扫描tests目录', async t => {
  const dir = await makeTree({
    'custom-cases/normal.json': goodFile,
    'custom-cases/bad.json': '{',
    'tests/test_unused.json': goodFile
  })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  let calls = 0
  const collection = await collectTests(
    configFor(dir, async () => {
      calls++
      return loadFolder(dir)
    })
  )
  assert.equal(calls, 1)
  assertPublicResult(collection)
  assert.equal(collection.errorCode, undefined)
  assert.deepEqual(
    collection.files.map(entry => entry.file),
    [path.join(dir, 'custom-cases/bad.json'), path.join(dir, 'custom-cases/normal.json')]
  )
  assert.ok(collection.files[0].error)
  assert.equal(collection.files[1].error, undefined)
})

test('loader排除的有效文件和原始下标不进清单，改组名、重排用例不影响来源', async t => {
  const source = `{ ${goodConfigs}, "cases": [
    { "image": "same.png", "hits": ["A"] },
    { "image": "same.png", "hits": ["B"] },
    { "image": "same.png", "hits": ["C"] }
  ] }`
  const dir = await makeTree({
    'custom-cases/keep.json': source,
    'custom-cases/drop.json': goodFile
  })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const cfg = configFor(dir, async () => {
    const all = await loadFolder(dir)
    return all
      .filter(group => group.source?.endsWith('keep.json'))
      .map(group => ({
        configs: { ...group.configs, name: '任意名字' },
        cases: [group.cases[2], group.cases[0]]
      }))
  })
  const collection = await collectTests(cfg)
  assert.equal(collection.files.length, 1)
  const file = collection.files[0]
  assert.equal(file.file, path.join(dir, 'custom-cases/keep.json'))
  assert.deepEqual(
    file.cases.map(testCase => testCase.index),
    [0, 2]
  )
  for (const testCase of file.cases) {
    assert.equal(JSON.parse(source.slice(testCase.start, testCase.end)).image, testCase.image)
  }
  const whole = await expandTestGroups(cfg, {
    targets: await buildRunTargets(['custom-cases/keep.json'], undefined, dir)
  })
  assert.deepEqual(
    whole.files[0].cases.map(testCase => testCase.index),
    [0, 2]
  )
  assert.deepEqual(whole.files[0].cases, file.cases)
  const excluded = await expandTestGroups(cfg, {
    targets: await buildRunTargets(['custom-cases/keep.json'], [1], dir)
  })
  assert.deepEqual(excluded.groups, [])
  assert.deepEqual(
    excluded.files[0].cases.map(testCase => testCase.index),
    [1]
  )
  const targets = await buildRunTargets(['custom-cases/keep.json'], [2], dir)
  const expanded = await expandTestGroups(cfg, { targets })
  assert.deepEqual(
    expanded.groups[0].cases.map(testCase => testCase.origin?.case),
    [2]
  )
  assert.deepEqual(expanded.groups[0].nodes, ['C', 'A'])
  assert.deepEqual(
    expanded.files[0].cases.map(testCase => testCase.index),
    [2]
  )
})

test('loadTestCases从原文件填origin，loader展开自然保留；读取和收集共用形状校验', async t => {
  const dir = await makeTree({
    'custom-cases/normal.json': `{ ${goodConfigs}, "cases": [
      {"image":"a.png","hits":[],"origin":{"file":"伪造路径","case":9}},
      {"image":"a.png","hits":["A"]}
    ] }`,
    'custom-cases/bad-shape.json': `{ ${goodConfigs} }`
  })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'custom-cases/normal.json')
  const loaded = await loadTestCases(file)
  assert.ok(loaded)
  assert.equal(loaded.source, file)
  assert.deepEqual(
    loaded.cases.map(testCase => testCase.origin),
    [
      { file, case: 0 },
      { file, case: 1 }
    ]
  )
  assert.equal(await loadTestCases(path.join(dir, 'custom-cases/bad-shape.json')), null)
  const expanded = await expandTestGroups(
    configFor(dir, async () => [loaded]),
    {
      targets: await buildRunTargets([file], 0)
    }
  )
  assert.deepEqual(expanded.groups[0].nodes, ['A'])
  assert.deepEqual(expanded.groups[0].cases[0].origin, { file, case: 0 })
})

test('外围读取记录保留配置模块顶层加载时的坏文件，并隔离并发收集', async t => {
  const dir = await makeTree({ 'custom-cases/normal.json': goodFile, 'custom-cases/bad.json': '{' })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const [first, second] = await Promise.all([
    captureTestFileReads(async () => {
      const groups = await loadFolder(dir)
      return collectTests(configFor(dir, groups))
    }),
    captureTestFileReads(async () => collectTests(configFor(dir, [])))
  ])
  assert.equal(first.value.files.length, 2)
  assert.equal(first.value.files.filter(file => file.error).length, 1)
  assert.deepEqual(second.value.files, [])
})

test('--file精确过滤实际发现结果，路径归一去重并保持选择顺序', async t => {
  const dir = await makeTree({ 'custom-cases/a.json': goodFile, 'custom-cases/b.json': goodFile })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const collection = await collectTests(
    configFor(dir, () => loadFolder(dir)),
    [
      'custom-cases/b.json',
      path.join(dir, 'custom-cases/a.json'),
      'custom-cases/../custom-cases/a.json'
    ]
  )
  assert.deepEqual(
    collection.files.map(file => file.file),
    [path.join(dir, 'custom-cases/b.json'), path.join(dir, 'custom-cases/a.json')]
  )
})

test('请求缺失或未进入配置的有效文件时给独立错误，不把它称作实际发现', async t => {
  const dir = await makeTree({ 'custom-cases/a.json': goodFile })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const collection = await collectTests(configFor(dir, []), ['missing.json', 'custom-cases/a.json'])
  assert.equal(collection.files[0].error, '找不到测试文件')
  assert.equal(collection.files[1].error, '测试文件没有进入当前配置展开的测试组')
  assert.deepEqual(collection.files[1].cases, [])
  assertPublicResult(collection)
})

test('无来源程序组在全量、按文件选择和收集入口都明确拒绝', async t => {
  const dir = await makeTree({ 'custom-cases/a.json': goodFile })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const cfg = configFor(dir, [
    {
      configs: { controller: 'C', resource: 'R' },
      cases: [{ image: 'x.png', hits: ['A'] }]
    } as unknown as TestCases
  ])
  const sourceError = (error: unknown) =>
    (error as { errorCode?: string }).errorCode === 'test-source-invalid'
  await assert.rejects(expandTestGroups(cfg), sourceError)
  const collection = await collectTests(cfg)
  assertPublicResult(collection)
  assert.equal(collection.errorCode, 'test-source-invalid')
  assert.deepEqual(collection.files, [])
  await assert.rejects(
    expandTestGroups(cfg, {
      targets: await buildRunTargets(['custom-cases/a.json'], undefined, dir)
    }),
    sourceError
  )
})

test('配置缺失、组形状错误和loader异常都有明确收集错误', async () => {
  const missing = await collectTests({ interfacePath: 'unused' })
  assertPublicResult(missing)
  assert.equal(missing.errorCode, 'test-config-missing')
  assert.deepEqual(await collectTests(configFor('.', [])), { files: [] })
  const malformed = configFor('.', [{} as TestCases])
  const invalid = await collectTests(malformed)
  assertPublicResult(invalid)
  assert.equal(invalid.errorCode, 'invalid-test-config')
  const throws = configFor('.', async () => {
    throw new Error('loader failed')
  })
  const failed = await collectTests(throws)
  assertPublicResult(failed)
  assert.equal(failed.errorCode, 'test-cases-load-failed')
  assert.equal(failed.reason, 'loader failed')
})

test('手写组的畸形origin给明确来源错误，不能抛路径类型错误或按内容猜测', async () => {
  const invalid = {
    configs: { controller: 'C', resource: 'R' },
    cases: [{ image: 'a.png', hits: ['A'], origin: { case: 0 } }]
  } as unknown as TestCases
  const collection = await collectTests(configFor('.', [invalid]))
  assertPublicResult(collection)
  assert.equal(collection.errorCode, 'test-source-invalid')
  assert.match(collection.reason ?? '', /origin/)
  await assert.rejects(
    expandTestGroups(configFor('.', [invalid])),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'test-source-invalid'
  )
})
