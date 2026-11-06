import assert from 'node:assert/strict'
import test from 'node:test'

import type { ColorMatchOptions } from '@nekosu/maa-types'

import { normalizeColorMatchOptions } from '../src/tools/colorRange.ts'

type NormalizeResult = ReturnType<typeof normalizeColorMatchOptions>

// RPC 传来的参数是任意 JSON，测试里故意构造非法结构，所以统一从 unknown 进入
function normalize(options: unknown): NormalizeResult {
  return normalizeColorMatchOptions(options as ColorMatchOptions)
}

function expectOk(options: unknown) {
  const result = normalize(options)
  if (!result.ok) {
    assert.fail(`expected ok, got error: ${result.error}`)
  }
  return result.value
}

function expectError(options: unknown): string {
  const result = normalize(options)
  if (result.ok) {
    assert.fail('expected failure, got ok')
  }
  assert.ok(result.error.length > 0)
  return result.error
}

test('RGB：三通道区间原样通过', () => {
  const value = expectOk({
    roi: [10, 20, 30, 40],
    method: 4,
    lower: [[1, 2, 3]],
    upper: [[250, 251, 252]],
    count: 1,
    connected: false
  })

  assert.deepEqual(value, {
    roi: [10, 20, 30, 40],
    method: 4,
    lower: [[1, 2, 3]],
    upper: [[250, 251, 252]],
    count: 1,
    connected: false
  })
})

test('HSV：允许多个区间，三个通道都保留', () => {
  const value = expectOk({
    roi: [0, 0, 1280, 720],
    method: 40,
    lower: [
      [0, 100, 100],
      [170, 100, 100]
    ],
    upper: [
      [10, 255, 255],
      [179, 255, 255]
    ],
    count: 2,
    connected: true
  })

  assert.equal(value.method, 40)
  assert.deepEqual(value.lower, [
    [0, 100, 100],
    [170, 100, 100]
  ])
  assert.deepEqual(value.upper, [
    [10, 255, 255],
    [179, 255, 255]
  ])
  assert.equal(value.count, 2)
  assert.equal(value.connected, true)
})

test('GRAY：允许多个单通道区间', () => {
  const value = expectOk({
    roi: [0, 0, 1, 1],
    method: 6,
    lower: [[10], [200]],
    upper: [[20], [240]],
    count: 1,
    connected: false
  })
  assert.deepEqual(value.lower, [[10], [200]])
  assert.deepEqual(value.upper, [[20], [240]])
})

test('GRAY：单通道区间合法', () => {
  const value = expectOk({
    roi: [0, 0, 1, 1],
    method: 6,
    lower: [[12]],
    upper: [[240]],
    count: 1,
    connected: false
  })

  assert.equal(value.method, 6)
  assert.deepEqual(value.lower, [[12]])
  assert.deepEqual(value.upper, [[240]])
})

test('越界值 clamp 到通道范围并四舍五入', () => {
  const rgb = expectOk({
    roi: [0, 0, 10, 10],
    method: 4,
    lower: [[-10, 300, 128.6]],
    upper: [[999, 255, -1]],
    count: 1,
    connected: false
  })
  assert.deepEqual(rgb.lower, [[0, 255, 129]])
  assert.deepEqual(rgb.upper, [[255, 255, 0]])

  // HSV 只有色相上限是 179，S/V 仍是 255
  const hsv = expectOk({
    roi: [0, 0, 10, 10],
    method: 40,
    lower: [[180, -5, 300]],
    upper: [[179, 255, 255]],
    count: 1,
    connected: false
  })
  assert.deepEqual(hsv.lower, [[179, 0, 255]])

  const gray = expectOk({
    roi: [0, 0, 10, 10],
    method: 6,
    lower: [[-1]],
    upper: [[300]],
    count: 1,
    connected: false
  })
  assert.deepEqual(gray.lower, [[0]])
  assert.deepEqual(gray.upper, [[255]])
})

test('通道数不匹配时报错', () => {
  const rgb = expectError({
    roi: [0, 0, 1, 1],
    method: 4,
    lower: [[0, 0]],
    upper: [[255, 255]],
    count: 1,
    connected: false
  })
  assert.match(rgb, /lower/)
  assert.match(rgb, /3 个通道/)

  const gray = expectError({
    roi: [0, 0, 1, 1],
    method: 6,
    lower: [[0, 0, 0]],
    upper: [[255]],
    count: 1,
    connected: false
  })
  assert.match(gray, /lower/)

  const hsv = expectError({
    roi: [0, 0, 1, 1],
    method: 40,
    lower: [[0, 0, 0, 0]],
    upper: [[255, 255, 255]],
    count: 1,
    connected: false
  })
  assert.match(hsv, /lower/)
})

test('lower/upper 区间数不一致时报错', () => {
  const error = expectError({
    roi: [0, 0, 1, 1],
    method: 40,
    lower: [
      [0, 0, 0],
      [170, 0, 0]
    ],
    upper: [[179, 255, 255]],
    count: 1,
    connected: false
  })
  assert.match(error, /区间数/)
})

test('count 取整且不低于 1，connected 转 boolean', () => {
  const rounded = expectOk({
    roi: [0, 0, 1, 1],
    method: 4,
    lower: [[0, 0, 0]],
    upper: [[255, 255, 255]],
    count: 2.6,
    connected: 1
  })
  assert.equal(rounded.count, 3)
  assert.equal(rounded.connected, true)

  const negative = expectOk({
    roi: [0, 0, 1, 1],
    method: 4,
    lower: [[0, 0, 0]],
    upper: [[255, 255, 255]],
    count: -4,
    connected: 0
  })
  assert.equal(negative.count, 1)
  assert.equal(negative.connected, false)

  const error = expectError({
    roi: [0, 0, 1, 1],
    method: 4,
    lower: [[0, 0, 0]],
    upper: [[255, 255, 255]],
    count: Number.POSITIVE_INFINITY,
    connected: false
  })
  assert.match(error, /count/)

  // 缺省 connected 按 false 处理，不依赖框架默认值
  const missing = expectOk({
    roi: [0, 0, 1, 1],
    method: 4,
    lower: [[0, 0, 0]],
    upper: [[255, 255, 255]],
    count: 1
  })
  assert.equal(missing.connected, false)
})

test('结构非法时返回明确错误', () => {
  assert.match(expectError(null), /options/)

  assert.match(
    expectError({
      method: 5,
      roi: [0, 0, 1, 1],
      lower: [[0, 0, 0]],
      upper: [[255, 255, 255]],
      count: 1
    }),
    /method/
  )

  assert.match(
    expectError({
      method: 4,
      roi: [0, 0, 1],
      lower: [[0, 0, 0]],
      upper: [[255, 255, 255]],
      count: 1
    }),
    /roi/
  )

  assert.match(
    expectError({
      method: 4,
      roi: [0, 0, -1, 1],
      lower: [[0, 0, 0]],
      upper: [[255, 255, 255]],
      count: 1
    }),
    /宽度和高度/
  )

  assert.match(
    expectError({
      method: 4,
      roi: [0, 0, 1, 1],
      lower: [],
      upper: [],
      count: 1
    }),
    /lower/
  )

  assert.match(
    expectError({
      method: 4,
      roi: [0, 0, 1, 1],
      lower: [[0, 0, Number.NaN]],
      upper: [[255, 255, 255]],
      count: 1
    }),
    /lower/
  )

  assert.match(
    expectError({
      method: 4,
      roi: [0, 0, 1, 1],
      lower: [[0, 0, 0]],
      upper: [[255, 255, 255]],
      count: '1'
    }),
    /count/
  )
})
