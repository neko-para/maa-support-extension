import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeHits, parseTestContent } from '../src/test/files.ts'

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
  const body = parseTestContent(content).body

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
  const body = parseTestContent(
    `{ "configs": { "controller": "Win32", "resource": "官服" }, "cases": [{ "name": "", "image": "a.png", "hits": [] }] }`
  ).body
  assert.equal(body.error, undefined)
  assert.equal(body.name, null)
  assert.equal(body.cases[0].name, null)
})

test('正常文件：controller/resource 是非空字符串时归一成单元素数组', () => {
  const body = parseTestContent(goodFile).body
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
  const body = parseTestContent(content).body
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
  const body = parseTestContent(content).body
  assert.equal(body.error, undefined)
  assert.equal(body.cases[0].image, 'a.png')
  assert.deepEqual(JSON.parse(content.slice(body.cases[0].start, body.cases[0].end)), {
    image: 'a.png',
    hits: []
  })
})

test('尾逗号算错：进 error 条目，消息是「JSON 解析失败：偏移 N」', () => {
  const body = parseTestContent(
    '{ "configs": { "controller": "Win32", "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] },] }'
  ).body
  assert.match(body.error ?? '', /^JSON 解析失败：偏移 \d+$/)
  assert.deepEqual(body.cases, [])
  assert.deepEqual(body.controllers, [])
  assert.deepEqual(body.resources, [])
  assert.equal(body.name, undefined)
})

test('形状错误：顶层不是对象 → 「顶层必须是对象（要有 configs 和 cases）」', () => {
  assert.equal(parseTestContent('[]').body.error, '顶层必须是对象（要有 configs 和 cases）')
  assert.equal(parseTestContent('"hello"').body.error, '顶层必须是对象（要有 configs 和 cases）')
  assert.equal(parseTestContent('null').body.error, '顶层必须是对象（要有 configs 和 cases）')
})

test('形状错误：缺 configs 对象 → 「缺少 configs 对象」', () => {
  assert.equal(
    parseTestContent('{ "cases": [{ "image": "a.png", "hits": [] }] }').body.error,
    '缺少 configs 对象'
  )
  assert.equal(
    parseTestContent('{ "configs": 5, "cases": [{ "image": "a.png", "hits": [] }] }').body.error,
    '缺少 configs 对象'
  )
})

test('形状错误：configs.controller 空/非字符串 → 「configs.controller 必须是非空字符串或字符串数组」', () => {
  const message = 'configs.controller 必须是非空字符串或字符串数组'
  assert.equal(
    parseTestContent(
      '{ "configs": { "controller": "", "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
  assert.equal(
    parseTestContent(
      '{ "configs": { "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
  assert.equal(
    parseTestContent(
      '{ "configs": { "controller": 3, "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
  assert.equal(
    parseTestContent(
      '{ "configs": { "controller": [], "resource": "官服" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
})

test('形状错误：configs.resource 空/非字符串 → 「configs.resource 必须是非空字符串或字符串数组」', () => {
  const message = 'configs.resource 必须是非空字符串或字符串数组'
  assert.equal(
    parseTestContent(
      '{ "configs": { "controller": "Win32", "resource": "" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
  assert.equal(
    parseTestContent(
      '{ "configs": { "controller": "Win32" }, "cases": [{ "image": "a.png", "hits": [] }] }'
    ).body.error,
    message
  )
})

test('形状错误：缺 cases 数组 → 「缺少 cases 数组」', () => {
  const message = '缺少 cases 数组'
  assert.equal(parseTestContent(`{ ${goodConfigs} }`).body.error, message)
  assert.equal(parseTestContent(`{ ${goodConfigs}, "cases": {} }`).body.error, message)
})

test('形状错误：cases 空 → 「cases 是空数组，没有可运行用例」', () => {
  assert.equal(
    parseTestContent(`{ ${goodConfigs}, "cases": [] }`).body.error,
    'cases 是空数组，没有可运行用例'
  )
})

test('形状错误：用例缺 image → 「第 N 个用例缺少 image（截图文件名）」', () => {
  assert.equal(
    parseTestContent(`{ ${goodConfigs}, "cases": [{ "hits": [] }] }`).body.error,
    '第 1 个用例缺少 image（截图文件名）'
  )
  assert.equal(
    parseTestContent(
      `{ ${goodConfigs}, "cases": [{ "image": "a.png", "hits": [] }, { "image": 5, "hits": [] }] }`
    ).body.error,
    '第 2 个用例缺少 image（截图文件名）'
  )
})

test('形状错误：用例缺 hits 数组 → 「第 N 个用例缺少 hits 数组（负例请写空数组）」', () => {
  assert.equal(
    parseTestContent(`{ ${goodConfigs}, "cases": [{ "image": "a.png" }] }`).body.error,
    '第 1 个用例缺少 hits 数组（负例请写空数组）'
  )
  assert.equal(
    parseTestContent(
      `{ ${goodConfigs}, "cases": [{ "image": "a.png", "hits": [] }, { "image": "b.png", "hits": {} }] }`
    ).body.error,
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
