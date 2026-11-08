import { computed, ref, shallowRef, watch } from 'vue'

import { hostState } from '../state'
import * as imageSt from './image'
import * as pickSt from './pick'

/**
 * 颜色范围命中预览：按当前取色推荐范围计算整图掩码，叠加到画布并给出命中像素统计。
 * 计算放在用户显式开启/参数变化防抖后，避免每次重绘都遍历整图。
 */
export const enabled = ref(false)
export const previewCanvas = shallowRef<HTMLCanvasElement | null>(null)
export const matched = ref(0)
export const total = ref(0)
export const ratio = computed(() => (total.value > 0 ? (matched.value / total.value) * 100 : 0))

let timer: ReturnType<typeof setTimeout> | undefined

function pixelMatches(
  color: [number, number, number],
  method: 4 | 40 | 6,
  ranges: { lower: number[][]; upper: number[][] }
) {
  const converted = pickSt.convertColor(color, method)
  for (let idx = 0; idx < ranges.lower.length; idx++) {
    const lower = ranges.lower[idx]!
    const upper = ranges.upper[idx]!
    let hit = true
    for (let channel = 0; channel < converted.length; channel++) {
      const value = converted[channel]!
      if (value < lower[channel]! || value > upper[channel]!) {
        hit = false
        break
      }
    }
    if (hit) {
      return true
    }
  }
  return false
}

export function clear() {
  previewCanvas.value = null
  matched.value = 0
  total.value = 0
}

export function refresh() {
  if (!enabled.value) {
    return
  }
  const img = imageSt.element.value
  const ranges = pickSt.effRanges(hostState.value.pickColorThreshold ?? 10)
  if (!img || !ranges) {
    clear()
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const method = pickSt.colorMethod.value

  let count = 0
  const data = imageData.data
  for (let idx = 0; idx < data.length; idx += 4) {
    const color: [number, number, number] = [data[idx]!, data[idx + 1]!, data[idx + 2]!]
    if (pixelMatches(color, method, ranges)) {
      data[idx] = 0
      data[idx + 1] = 255
      data[idx + 2] = 0
      data[idx + 3] = 128
      count += 1
    } else {
      // 非命中像素也画一层：低透明度的原图灰度，让命中区更突出
      const gray = Math.round(0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!)
      data[idx] = gray
      data[idx + 1] = gray
      data[idx + 2] = gray
      data[idx + 3] = 60
    }
  }
  ctx.putImageData(imageData, 0, 0)
  previewCanvas.value = canvas
  matched.value = count
  total.value = canvas.width * canvas.height
}

function scheduleRefresh(delay = 200) {
  if (!enabled.value) {
    return
  }
  globalThis.clearTimeout(timer)
  timer = globalThis.setTimeout(() => {
    refresh()
  }, delay)
}

export function setEnabled(value: boolean) {
  enabled.value = value
  if (value) {
    refresh()
  } else {
    clear()
  }
}

// 取色点是就地 push 的，只监听数组引用会漏掉新增采样；手动覆盖、推荐范围、阈值变化都要重算
watch([() => pickSt.effRaw.value, () => hostState.value.pickColorThreshold], () =>
  scheduleRefresh()
)

watch(
  () => imageSt.data.value,
  () => {
    if (enabled.value) {
      refresh()
    }
  }
)
