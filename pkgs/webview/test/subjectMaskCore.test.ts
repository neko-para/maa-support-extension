import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSubjectMask } from '../src/crop/utils/subjectMaskCore.ts'

const WIDTH = 80
const HEIGHT = 60
const BG: [number, number, number] = [80, 40, 160]
const SUBJECT: [number, number, number] = [245, 245, 245]
const DOT: [number, number, number] = [200, 30, 30]

function makeImage() {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4
      const inSubject = x >= 15 && x <= 54 && y >= 12 && y <= 42
      const inDot = x >= 30 && x <= 41 && y >= 22 && y <= 33
      const color = inDot ? DOT : inSubject ? SUBJECT : BG
      data[idx] = color[0]
      data[idx + 1] = color[1]
      data[idx + 2] = color[2]
      data[idx + 3] = 255
    }
  }
  return data
}

function makeRegion(x0: number, y0: number, x1: number, y1: number) {
  const region = new Uint8Array(WIDTH * HEIGHT)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      region[y * WIDTH + x] = 1
    }
  }
  return region
}

function px(mask: Uint8Array, x: number, y: number) {
  return mask[y * WIDTH + x]
}

test('圈选主体：圈内背景按颜色判为绿幕，白色主体与内部彩色按钮保留', () => {
  // 圈选比主体大一圈（含紫色边），模拟手画不精确
  const result = buildSubjectMask(makeImage(), WIDTH, HEIGHT, makeRegion(10, 8, 59, 47))
  assert.ok(result.backgroundSamples > 0)
  assert.equal(px(result.mask, 0, 0), 1, '圈外是背景')
  assert.equal(px(result.mask, 12, 10), 1, '圈内留出的紫色边是背景')
  assert.equal(px(result.mask, 20, 20), 0, '白色主体保留')
  assert.equal(px(result.mask, 35, 27), 0, '主体内部彩色按钮保留（填洞）')
  assert.ok(
    result.subjectPixels > 1100 && result.subjectPixels < 1500,
    `subject=${result.subjectPixels}`
  )
})

test('圈选紧贴主体时，仍能从圈外取到背景样本', () => {
  const result = buildSubjectMask(makeImage(), WIDTH, HEIGHT, makeRegion(15, 12, 54, 42))
  assert.ok(result.backgroundSamples > 0)
  assert.equal(px(result.mask, 0, 0), 1)
  assert.equal(px(result.mask, 20, 20), 0)
  assert.equal(px(result.mask, 35, 27), 0)
})

test('圈选覆盖整图时没有背景样本，交给 UI 提示而不是瞎猜', () => {
  const result = buildSubjectMask(
    makeImage(),
    WIDTH,
    HEIGHT,
    makeRegion(0, 0, WIDTH - 1, HEIGHT - 1)
  )
  assert.equal(result.backgroundSamples, 0)
  assert.equal(result.backgroundPixels, 0)
  assert.equal(result.subjectPixels, WIDTH * HEIGHT)
})
