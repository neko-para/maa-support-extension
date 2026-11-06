import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBackgroundMask, estimateBackground } from '../src/crop/utils/autoMaskCore.ts'

const WIDTH = 20
const HEIGHT = 20
const BG: [number, number, number] = [10, 20, 30]
const SUBJECT: [number, number, number] = [200, 0, 0]

function makeImage() {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4
      const inSubject = x >= 5 && x <= 14 && y >= 5 && y <= 14
      const island = x >= 8 && x <= 10 && y >= 8 && y <= 10
      const color = inSubject && !island ? SUBJECT : BG
      data[idx] = color[0]
      data[idx + 1] = color[1]
      data[idx + 2] = color[2]
      data[idx + 3] = 255
    }
  }
  return data
}

function pixel(mask: Uint8Array, x: number, y: number) {
  return mask[y * WIDTH + x]
}

test('estimateBackground 从四边取中位数', () => {
  assert.deepEqual(estimateBackground(makeImage(), WIDTH, HEIGHT, 2), BG)
})

test('边缘泛洪只吃掉与边缘连通的背景，保留主体内部同色区域', () => {
  const result = buildBackgroundMask(makeImage(), WIDTH, HEIGHT, {
    method: 'border-grow',
    tolerance: 10
  })
  assert.equal(pixel(result.mask, 0, 0), 1, '角落是背景')
  assert.equal(pixel(result.mask, 5, 10), 0, '主体左边缘不是背景')
  assert.equal(pixel(result.mask, 10, 10), 0, '主体内部同色 island 不是背景')
  assert.equal(result.backgroundPixels, WIDTH * HEIGHT - 100)
})

test('全图相似色会命中主体内部同色区域', () => {
  const result = buildBackgroundMask(makeImage(), WIDTH, HEIGHT, {
    method: 'threshold',
    tolerance: 10
  })
  assert.equal(pixel(result.mask, 10, 10), 1, 'island 与背景同色，应被全图相似色命中')
  assert.equal(result.backgroundPixels, WIDTH * HEIGHT - 100 + 9)
})

test('背景外扩让主体边缘 1px 也进入 mask', () => {
  const result = buildBackgroundMask(makeImage(), WIDTH, HEIGHT, {
    method: 'border-grow',
    tolerance: 10,
    expand: 1
  })
  assert.equal(pixel(result.mask, 5, 10), 1, '外扩后主体左边缘变背景')
  assert.equal(pixel(result.mask, 10, 10), 0, '主体中心仍是前景')
  assert.ok(result.backgroundPixels > WIDTH * HEIGHT - 100)
})

test('容差为 0 时只认完全相同的颜色', () => {
  const data = makeImage()
  // 把左上角像素改成轻微不同，容差 0 下不应被泛洪吞掉
  data[0] = 11
  const result = buildBackgroundMask(data, WIDTH, HEIGHT, {
    method: 'border-grow',
    tolerance: 0
  })
  assert.equal(pixel(result.mask, 0, 0), 0)
  assert.equal(pixel(result.mask, 1, 0), 1)
})
