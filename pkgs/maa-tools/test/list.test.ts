import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import test from 'node:test'

import { collectTests, listTestContent, normalizeHits } from '../src/test/list.ts'
import { expandTestGroups } from '../src/test/plan.ts'
import { buildRunTargets } from '../src/test/targets.ts'
import type { FullConfig, TestCases } from '../src/types/config.ts'
import { captureTestFileReads, loadAllTestCases, loadTestCases } from '../src/utils/tools.ts'

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

test('正常文件：多用例、name 归一、字符串/对象 hits 归一（去重保序、忽略其它）', () => {
  const content = `{
    "configs": {
      "name": "通用按钮",
      "controller": ["Win32", "ADB", "Win32"],
      "resource": ["官服", "官服"]
    },
    "cases": [
      {
        "name": "关按钮",
        "image": "close.png",
        "hits": ["关闭按钮", { "node": "关闭按钮", "box": [0, 0, 10, 10] }, { "node": "确认" }, 42, { "node": "确认" }]
      },
      { "image": "back.png", "hits": [] }
    ]
  }`
  const body = listTestContent(content)

  assert.equal(body.error, undefined)
  assert.equal(body.name, '通用按钮')
  // 字符串数组去重保序
  assert.deepEqual(body.controllers, ['Win32', 'ADB'])
  assert.deepEqual(body.resources, ['官服'])
  assert.equal(body.cases.length, 2)

  const [first, second] = body.cases
  assert.equal(first.index, 0)
  assert.equal(first.name, '关按钮')
  assert.equal(first.image, 'close.png')
  // 字符串取原样、对象取 node；同名去重保序；42 这种其它类型忽略
  assert.deepEqual(first.hits, ['关闭按钮', '确认'])
  // 第二条没写 name → null
  assert.equal(second.index, 1)
  assert.equal(second.name, null)
  assert.equal(second.image, 'back.png')
  assert.deepEqual(second.hits, [])
})

test('正常文件：configs.name / 用例 name 缺省或空串都是 null', () => {
  const body = listTestContent(
    `{ "configs": { "controller": "Win32", "resource": "官服" }, "cases": [{ "name": "", "image": "a.png", "hits": [] }] }`
  )
  assert.equal(body.error, undefined)
  assert.equal(body.name, null)
  assert.equal(body.cases[0].name, null)
})

test('正常文件：controller/resource 是非空字符串时归一成单元素数组', () => {
  const body = listTestContent(goodFile)
  assert.deepEqual(body.controllers, ['Win32'])
  assert.deepEqual(body.resources, ['官服'])
})

test('字符偏移：start/end 能切出该用例的原文（含左右花括号，end 开区间）', () => {
  const content = `{
    "configs": { "name": "通用按钮", "controller": ["Win32", "ADB"], "resource": ["官服"] },
    "cases": [
      {
        "name": "关按钮",
        "image": "close.png",
        "hits": ["关闭按钮", { "node": "确认" }]
      },
      { "image": "back.png", "hits": [] }
    ]
  }`
  const body = listTestContent(content)
  assert.equal(body.error, undefined)
  const [first, second] = body.cases

  for (const item of body.cases) {
    const slice = content.slice(item.start, item.end)
    assert.equal(slice.startsWith('{'), true)
    assert.equal(slice.endsWith('}'), true)
    assert.match(slice, new RegExp(item.image.replace('.', '\\.')))
  }
  assert.deepEqual(JSON.parse(content.slice(first.start, first.end)), {
    name: '关按钮',
    image: 'close.png',
    hits: ['关闭按钮', { node: '确认' }]
  })
  assert.deepEqual(JSON.parse(content.slice(second.start, second.end)), {
    image: 'back.png',
    hits: []
  })
  // 两段范围不重叠、顺序和 cases 一致
  assert.ok(first.end <= second.start)
})

test('注释放行：行注释、块注释都不算错，偏移照常切出用例原文', () => {
  const content = `{
    // 顶层行注释
    /* 块注释 */
    "configs": { // 注释
      "controller": "Win32",
      "resource": "官服"
    },
    "cases": [
      // 第一条之前
      { "image": "a.png", "hits": [] } // 第一条之后
    ]
  }`
  const body = listTestContent(content)
  assert.equal(body.error, undefined)
  assert.equal(body.cases[0].image, 'a.png')
  assert.deepEqual(JSON.parse(content.slice(body.cases[0].start, body.cases[0].end)), {
    image: 'a.png',
    hits: []
  })
})

test('尾逗号算错：进 error 条目，消息是「JSON 解析失败：偏移 N」', () => {
  const body = listTestContent(
    '{ "configs": { "controller": "Win32", "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] },] }'
  )
  assert.match(body.error ?? '', /^JSON 解析失败：偏移 \d+$/)
  assert.deepEqual(body.cases, [])
  assert.deepEqual(body.controllers, [])
  assert.deepEqual(body.resources, [])
  assert.equal(body.name, undefined)
})

test('形状错误：顶层不是对象 → 「顶层必须是对象（要有 configs 和 cases）」', () => {
  assert.equal(listTestContent('[]').error, '顶层必须是对象（要有 configs 和 cases）')
  assert.equal(listTestContent('"hello"').error, '顶层必须是对象（要有 configs 和 cases）')
  assert.equal(listTestContent('null').error, '顶层必须是对象（要有 configs 和 cases）')
})

test('形状错误：缺 configs 对象 → 「缺少 configs 对象」', () => {
  assert.equal(
    listTestContent('{ "cases": [{ "image": "a.png", "hits": [] }] }').error,
    '缺少 configs 对象'
  )
  assert.equal(
    listTestContent('{ "configs": 5, "cases": [{ "image": "a.png", "hits": [] }] }').error,
    '缺少 configs 对象'
  )
})

test('形状错误：configs.controller 空/非字符串 → 「configs.controller 必须是非空字符串或字符串数组」', () => {
  const message = 'configs.controller 必须是非空字符串或字符串数组'
  assert.equal(
    listTestContent(
      '{ "configs": { "controller": "", "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
  assert.equal(
    listTestContent(
      '{ "configs": { "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
  assert.equal(
    listTestContent(
      '{ "configs": { "controller": 3, "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
  assert.equal(
    listTestContent(
      '{ "configs": { "controller": [], "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
})

test('形状错误：configs.resource 空/非字符串 → 「configs.resource 必须是非空字符串或字符串数组」', () => {
  const message = 'configs.resource 必须是非空字符串或字符串数组'
  assert.equal(
    listTestContent(
      '{ "configs": { "controller": "Win32", "resource": "" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
  assert.equal(
    listTestContent(
      '{ "configs": { "controller": "Win32" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).error,
    message
  )
})

test('形状错误：缺 cases 数组 → 「缺少 cases 数组」', () => {
  const message = '缺少 cases 数组'
  assert.equal(listTestContent(`{ ${goodConfigs} }`).error, message)
  assert.equal(listTestContent(`{ ${goodConfigs}, "cases": {} }`).error, message)
})

test('形状错误：cases 空 → 「cases 是空数组，没有可运行用例」', () => {
  assert.equal(
    listTestContent(`{ ${goodConfigs}, "cases": [] }`).error,
    'cases 是空数组，没有可运行用例'
  )
})

test('形状错误：用例缺 image → 「第 N 个用例缺少 image（截图文件名）」', () => {
  assert.equal(
    listTestContent(`{ ${goodConfigs}, "cases": [{ "hits": [] }] }`).error,
    '第 1 个用例缺少 image（截图文件名）'
  )
  assert.equal(
    listTestContent(
      `{ ${goodConfigs}, "cases": [{ "image": "a.png", "hits": [] }, { "image": 5, "hits": [] }] }`
    ).error,
    '第 2 个用例缺少 image（截图文件名）'
  )
})

test('形状错误：用例缺 hits 数组 → 「第 N 个用例缺少 hits 数组（负例请写空数组）」', () => {
  assert.equal(
    listTestContent(`{ ${goodConfigs}, "cases": [{ "image": "a.png" }] }`).error,
    '第 1 个用例缺少 hits 数组（负例请写空数组）'
  )
  assert.equal(
    listTestContent(
      `{ ${goodConfigs}, "cases": [{ "image": "a.png", "hits": [] }, { "image": "b.png", "hits": {} }] }`
    ).error,
    '第 2 个用例缺少 hits 数组（负例请写空数组）'
  )
})

test('normalizeHits：字符串原样、对象取 node、其它忽略、去重保序', () => {
  assert.deepEqual(
    normalizeHits(['A', { node: 'B' }, 'A', { node: 'B' }, 42, null, { node: 3 }, { box: [1, 2] }]),
    ['A', 'B']
  )
  assert.deepEqual(normalizeHits('不是数组'), [])
})

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
  assert.equal(collection.schemaVersion, 1)
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
})

test('无来源程序组仍可全量展开，收集明确提示不完整，按文件选择报来源错误', async t => {
  const dir = await makeTree({ 'custom-cases/a.json': goodFile })
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const cfg = configFor(dir, [
    { configs: { controller: 'C', resource: 'R' }, cases: [{ image: 'x.png', hits: ['A'] }] }
  ])
  assert.equal((await expandTestGroups(cfg)).groups.length, 1)
  const collection = await collectTests(cfg)
  assert.equal(collection.errorCode, 'collection-source-missing')
  assert.deepEqual(collection.files, [])
  await assert.rejects(
    expandTestGroups(cfg, {
      targets: await buildRunTargets(['custom-cases/a.json'], undefined, dir)
    }),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'test-source-missing'
  )
})

test('配置缺失、组形状错误和loader异常都有明确收集错误', async () => {
  assert.equal((await collectTests({ interfacePath: 'unused' })).errorCode, 'test-config-missing')
  assert.deepEqual(await collectTests(configFor('.', [])), { schemaVersion: 1, files: [] })
  const malformed = configFor('.', [{} as TestCases])
  assert.equal((await collectTests(malformed)).errorCode, 'invalid-test-config')
  const throws = configFor('.', async () => {
    throw new Error('loader failed')
  })
  const failed = await collectTests(throws)
  assert.equal(failed.errorCode, 'test-cases-load-failed')
  assert.equal(failed.reason, 'loader failed')
})

test('手写组的畸形origin给明确来源错误，不能抛路径类型错误或按内容猜测', async () => {
  const invalid = {
    configs: { controller: 'C', resource: 'R' },
    cases: [{ image: 'a.png', hits: ['A'], origin: { case: 0 } }]
  } as unknown as TestCases
  const collection = await collectTests(configFor('.', [invalid]))
  assert.equal(collection.errorCode, 'test-source-invalid')
  assert.match(collection.reason ?? '', /origin/)
  await assert.rejects(
    expandTestGroups(configFor('.', [invalid])),
    (error: unknown) => (error as { errorCode?: string }).errorCode === 'test-source-invalid'
  )
})
