import { createJiti } from 'jiti'
import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test, { type TestContext } from 'node:test'

import { buildRunTargets } from '../src/test/selection.ts'
import type { TestRunEvent } from '../src/test/types.ts'
import type { FullConfig, TestCases } from '../src/types/config.ts'
import { assertPublicResult } from './assertions.ts'

const runtime = createJiti(import.meta.url, { fsCache: false }).import<
  typeof import('../src/index')
>('../src/index.ts')
const { collectTests, loadTestCases } = await runtime

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maa-tools-file-library-results-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'error', () => {})
  return root
}

async function writeCases(root: string, name: string, image: string, hits: string[] = ['A']) {
  const file = path.join(root, name)
  await fs.writeFile(
    file,
    JSON.stringify({
      configs: { name: '文件测试显示组', controller: 'C', resource: 'R' },
      cases: [{ image, hits }]
    })
  )
  return file
}

for (const verdict of ['skipped', 'error'] as const) {
  test(`真实文件${verdict}在详细结果、进度和错误保存中都只出现一次`, async t => {
    const root = await fixture(t)
    const logs: string[] = []
    t.mock.method(console, 'log', (...args: unknown[]) => logs.push(args.join(' ')))
    const image = verdict === 'error' ? 'exists.png' : 'missing.png'
    if (verdict === 'error') await fs.writeFile(path.join(root, image), '')
    const file = await writeCases(root, 'selected.json', image, verdict === 'error' ? [] : ['A'])
    let setupCalls = 0
    const cfg: FullConfig = {
      cwd: root,
      interfacePath: 'unused',
      get maaCache(): string {
        setupCalls++
        throw new Error('SETUP_MUST_NOT_RUN')
      },
      test: {
        cases: async () => [(await loadTestCases(file))!],
        errorDetailsPath: 'reports/error.json'
      }
    }
    const events: TestRunEvent[] = []
    const { runTestDetailed, runTest } = await runtime
    const detailed = await runTestDetailed(cfg, {
      onEvent: event => {
        events.push(event)
      }
    })
    assertPublicResult(detailed)
    assertPublicResult(events)
    assert.equal(detailed.status, 'error')
    assert.equal(detailed.files.length, 1)
    const item = detailed.files[0].cases[0]
    assert.equal(item.platforms.length, 1)
    assert.equal(item.platforms[0].result.verdict, verdict)
    assert.equal(item.platforms[0].result.imagePath, path.join(root, image))
    assert.deepEqual(item.platforms[0].result.origin, { file, case: 0 })
    assert.deepEqual(
      events.map(event => event.type),
      ['case-result', 'file-result']
    )
    for (const event of events) {
      if (event.type !== 'case-started') assert.deepEqual(event.result.files, detailed.files)
    }
    assert.ok(logs.some(log => log.includes('文件测试显示组')))
    assert.equal(
      Object.hasOwn(JSON.parse(await fs.readFile(file, 'utf8')).cases[0], 'origin'),
      false
    )
    const savedPath = path.join(root, 'reports/error.json')
    await assert.rejects(fs.access(savedPath), { code: 'ENOENT' })
    assert.equal(await runTest(cfg), false)
    const saved = JSON.parse(await fs.readFile(savedPath, 'utf8'))
    assertPublicResult(saved)
    assert.equal(saved.status, detailed.status)
    assert.equal(saved.errorCode, detailed.errorCode)
    assert.deepEqual(saved.files, detailed.files)
    assert.equal(setupCalls, 0)
    assert.equal((await fs.readdir(root)).includes('debug'), false)
  })
}

test('混合文件与坏文件仍独立完成，保存报告和全部快照保留准确文件归属', async t => {
  const root = await fixture(t)
  const missing = await writeCases(root, 'missing-image.json', 'missing.png')
  const noNodes = await writeCases(root, 'no-nodes.json', 'exists.png', [])
  const broken = path.join(root, 'broken.json')
  await fs.writeFile(path.join(root, 'exists.png'), '')
  await fs.writeFile(broken, '{')
  const cfg: FullConfig = {
    cwd: root,
    interfacePath: 'unused',
    get maaCache(): string {
      throw new Error('SETUP_MUST_NOT_RUN')
    },
    test: {
      cases: async () => {
        const first = (await loadTestCases(missing))!
        const second = (await loadTestCases(noNodes))!
        await loadTestCases(broken)
        return [{ ...first, nodes: [], cases: [...first.cases, ...second.cases] }]
      }
    }
  }
  const events: TestRunEvent[] = []
  const { runTestDetailed, runTest } = await runtime
  const final = await runTestDetailed(cfg, {
    onEvent: event => {
      events.push(event)
    }
  })
  assertPublicResult(final)
  assertPublicResult(events)
  assert.equal(final.errorCode, 'test-file-error')
  assert.equal(final.files.length, 3)
  assert.equal(final.files.find(file => file.file === broken)!.verdict, 'error')
  for (const [file, verdict] of [
    [missing, 'skipped'],
    [noNodes, 'error']
  ] as const) {
    const item = final.files.find(item => item.file === file)!
    assert.deepEqual(item.selectedCases, [0])
    assert.equal(item.cases[0].platforms[0].result.verdict, verdict)
    assert.deepEqual(item.cases[0].platforms[0].result.origin, { file, case: 0 })
  }
  assert.equal(events.filter(event => event.type === 'case-started').length, 0)
  assert.equal(events.filter(event => event.type === 'case-result').length, 2)
  assert.equal(events.filter(event => event.type === 'file-result').length, 3)
  for (const event of events) {
    if (event.type === 'case-started') continue
    const file = event.type === 'case-result' ? event.origin.file : event.file
    assert.deepEqual(
      event.result.files,
      final.files.filter(item => item.file === file)
    )
  }
  assert.equal(await runTest(cfg), false)
  const saved = JSON.parse(await fs.readFile(path.join(root, 'maatoolsErrorDetails.json'), 'utf8'))
  assertPublicResult(saved)
  assert.deepEqual(saved.files, final.files)
})

const invalidOrigins: [string, (file: string) => unknown][] = [
  ['缺少', () => undefined],
  ['null', () => null],
  ['相对路径', () => ({ file: 'relative.json', case: 0 })],
  ['空路径', () => ({ file: '', case: 0 })],
  ['非字符串路径', () => ({ file: 17, case: 0 })],
  ['缺下标', file => ({ file })],
  ['负下标', file => ({ file, case: -1 })],
  ['小数下标', file => ({ file, case: 0.5 })],
  ['非安全下标', file => ({ file, case: Number.MAX_SAFE_INTEGER + 1 })],
  ['字符串下标', file => ({ file, case: '0' })],
  ['NaN下标', file => ({ file, case: NaN })],
  ['Infinity下标', file => ({ file, case: Infinity })],
  ['不存在的文件', file => ({ file: `${file}.missing`, case: 0 })],
  ['不存在的下标', file => ({ file, case: 17 })]
]

for (const [label, makeOrigin] of invalidOrigins) {
  test(`库全量/按文件/收集均在准备前拒绝${label}origin，不发假进度`, async t => {
    const root = await fixture(t)
    await fs.writeFile(path.join(root, 'exists.png'), '')
    const file = await writeCases(root, 'selected.json', 'exists.png')
    const loaded = (await loadTestCases(file))!
    const invalidCase = { image: 'exists.png', hits: ['A'], origin: makeOrigin(file) }
    if (label === '缺少') delete invalidCase.origin
    const invalid = { ...loaded, cases: [...loaded.cases, invalidCase] } as unknown as TestCases
    let setupCalls = 0
    const cfg: FullConfig = {
      cwd: root,
      interfacePath: 'unused',
      get maaCache(): string {
        setupCalls++
        throw new Error('SETUP_MUST_NOT_RUN')
      },
      test: { cases: [invalid] }
    }
    const { runTestDetailed, runTest } = await runtime
    const targets = await buildRunTargets([file])
    for (const options of [{}, { targets }, { controllers: ['excluded'] }]) {
      const events: TestRunEvent[] = []
      const result = await runTestDetailed(cfg, {
        ...options,
        onEvent: event => {
          events.push(event)
        }
      })
      assertPublicResult(result)
      assert.equal(result.status, 'error')
      assert.equal(result.errorCode, 'test-source-invalid')
      assert.match(result.reason!, /origin/)
      assert.deepEqual(events, [])
    }
    const collection = await collectTests(cfg)
    assertPublicResult(collection)
    assert.equal(collection.errorCode, 'test-source-invalid')
    assert.equal(await runTest(cfg), false)
    const saved = JSON.parse(
      await fs.readFile(path.join(root, 'maatoolsErrorDetails.json'), 'utf8')
    )
    assertPublicResult(saved)
    assert.equal(saved.errorCode, 'test-source-invalid')
    if (label === '不存在的文件' || label === '不存在的下标') {
      assert.ok(saved.files.length > 0)
      assert.ok(
        saved.files.every((item: { cases: { platforms: unknown[] }[] }) =>
          item.cases.every(testCase => testCase.platforms.length === 0)
        )
      )
    } else {
      assert.deepEqual(saved.files, [])
    }
    assert.equal(setupCalls, 0)
    assert.equal((await fs.readdir(root)).includes('debug'), false)
  })
}
