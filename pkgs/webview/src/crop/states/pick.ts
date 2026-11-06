import { computed, ref, watch } from 'vue'

import { ipc } from '../ipc'
import { Box } from '../utils/2d'
import { exitMode, mode, setMode } from './mode'

/** 取色（点选）/ 框选共享单一画布模式，避免两个布尔同时为真 */
export const picking = computed({
  get: () => mode.value === 'pick-point',
  set: active => {
    if (active) {
      setMode('pick-point')
    } else if (mode.value === 'pick-point') {
      exitMode()
    }
  }
})
export const selecting = computed({
  get: () => mode.value === 'pick-rect',
  set: active => {
    if (active) {
      setMode('pick-rect')
    } else if (mode.value === 'pick-rect') {
      exitMode()
    }
  }
})
export const selectBox = ref<Box | null>(null)

// 离开框选模式时清掉尚未提交的选区
watch(mode, current => {
  if (current !== 'pick-rect') {
    selectBox.value = null
  }
})

export const color = ref<[r: number, g: number, b: number] | null>(null)

export type SamplePoint = {
  id: number
  pos: [x: number, y: number]
  color: [r: number, g: number, b: number]
}

let nextId = 0
export const samplePoints = ref<SamplePoint[]>([])

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rp = r / 255
  const gp = g / 255
  const bp = b / 255

  const cmax = Math.max(rp, gp, bp)
  const cmin = Math.min(rp, gp, bp)
  const dlt = cmax - cmin

  let h: number
  if (dlt === 0) {
    h = 0
  } else if (cmax === rp) {
    h = ((gp - bp) / dlt + 6) % 6
  } else if (cmax === gp) {
    h = (bp - rp) / dlt + 2
  } else {
    h = (rp - gp) / dlt + 4
  }

  const s = cmax === 0 ? 0 : dlt / cmax
  const v = cmax

  return [Math.floor(h * 30), Math.round(s * 255), Math.round(v * 255)]
}

function rgbToGray(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b)
}

function circularHueRange(hues: number[]): [number, number] {
  const sorted = [...hues].sort((a, b) => a - b)
  let maxGap = 0
  let gapEnd = 0
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!
    const b = sorted[(i + 1) % sorted.length]!
    const gap = (b - a + 180) % 180
    if (gap > maxGap) {
      maxGap = gap
      gapEnd = i
    }
  }
  return [sorted[(gapEnd + 1) % sorted.length]!, sorted[gapEnd]!]
}

function circularHueMean(hues: number[]): number {
  let cosSum = 0
  let sinSum = 0
  for (const h of hues) {
    const rad = (h * Math.PI) / 90
    cosSum += Math.cos(rad)
    sinSum += Math.sin(rad)
  }
  const mean = (Math.atan2(sinSum, cosSum) * 90) / Math.PI
  return mean < 0 ? mean + 180 : mean
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 180 - d)
}

export type ColorMethod = 4 | 40 | 6

export const colorMethod = ref<ColorMethod>(4)

export function convertColor(clr: [number, number, number], method: ColorMethod): number[] {
  switch (method) {
    case 4:
      return [...clr]
    case 40:
      return [...rgbToHsv(clr[0], clr[1], clr[2])]
    case 6:
      return [rgbToGray(clr[0], clr[1], clr[2])]
  }
}

export function formatColorText(clr: [number, number, number], method: ColorMethod) {
  return convertColor(clr, method).join(', ')
}

function channelMax(channelIndex: number, method: ColorMethod): number {
  if (method === 40 && channelIndex === 0) return 180
  return 255
}

export const hsvColor = computed<[h: number, s: number, v: number] | null>(() => {
  if (!color.value) return null
  return rgbToHsv(...color.value)
})

export function start() {
  setMode('pick-point')
  color.value = null
}

export function startSelect() {
  setMode('pick-rect')
  selectBox.value = null
}

export function addSelectSamplePoints(imageData: ImageData, box: Box) {
  const points: { color: [number, number, number]; pos: [number, number] }[] = []

  const step = Math.max(1, Math.floor(Math.min(box.size.w, box.size.h) / 10))

  for (let my = 0; my < imageData.height; my += step) {
    for (let mx = 0; mx < imageData.width; mx += step) {
      const idx = (my * imageData.width + mx) * 4
      const color: [number, number, number] = [
        imageData.data[idx]!,
        imageData.data[idx + 1]!,
        imageData.data[idx + 2]!
      ]
      const pos: [number, number] = [Math.floor(box.origin.x + mx), Math.floor(box.origin.y + my)]
      points.push({ color, pos })
    }
  }

  for (const point of points) {
    samplePoints.value.push({
      id: nextId++,
      pos: point.pos,
      color: point.color
    })
  }

  selecting.value = false
  selectBox.value = null
}

export function addSamplePoint(pos: [x: number, y: number]) {
  if (color.value) {
    samplePoints.value.push({
      id: nextId++,
      pos: [...pos],
      color: [...color.value]
    })
  }
}

export function removeSamplePoint(id: number) {
  samplePoints.value = samplePoints.value.filter(p => p.id !== id)
}

export function clearSamplePoints() {
  samplePoints.value = []
}

export function cssText() {
  return color.value
    ? `#${color.value.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join('')}`
    : ''
}

export function copyCss() {
  const text = cssText()
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}

export function arrayText(threshold: number, method?: ColorMethod) {
  if (!color.value) {
    return undefined
  }
  const m = method ?? colorMethod.value
  const converted = convertColor(color.value, m)
  return `[${converted.map((x, i) => Math.min(Math.max(x + threshold, 0), channelMax(i, m))).join(', ')}]`
}

export function copyArray(threshold: number, method?: ColorMethod) {
  const text = arrayText(threshold, method)
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}

export function hsvText() {
  if (!hsvColor.value) {
    return undefined
  }
  return `[${hsvColor.value.join(', ')}]`
}

export function copyHsv() {
  const text = hsvText()
  if (text) {
    ipc.send({
      command: 'writeClipboard',
      text
    })
  }
}

export type RecommendMethod = 'minmax' | 'meanstd'

export const recommendMethod = ref<RecommendMethod>('minmax')

export const recommendedColors = computed(() => {
  if (samplePoints.value.length === 0) {
    return null
  }

  const method = colorMethod.value
  const converted = samplePoints.value.map(p => convertColor(p.color, method))
  const channels = converted[0]!.length
  const isHsv = method === 40

  if (recommendMethod.value === 'minmax') {
    const min: number[] = Array(channels).fill(255)
    const max: number[] = Array(channels).fill(0)

    for (const c of converted) {
      for (let i = 0; i < channels; i++) {
        min[i] = Math.min(min[i]!, c[i]!)
        max[i] = Math.max(max[i]!, c[i]!)
      }
    }

    // HSV hue is circular (0-180). When samples straddle the red boundary
    // (e.g. 178, 179, 0, 2), naive min/max gives [0, 179] covering all hues.
    // Find the tight cluster instead: lower > upper signals a wrap-around
    // range to OpenCV, matching hues >= lower OR <= upper.
    if (isHsv && max[0]! - min[0]! > 90) {
      const hues = converted.map(c => c[0]!)
      const [cl, cu] = circularHueRange(hues)
      min[0] = cl
      max[0] = cu
    }

    return { lower: min, upper: max }
  } else {
    let lower: number[]
    let upper: number[]

    if (isHsv) {
      const hues = converted.map(c => c[0]!)
      const cMean = circularHueMean(hues)
      const dists = hues.map(h => hueDist(h, cMean))
      const hStd = Math.ceil(Math.sqrt(dists.reduce((s, d) => s + d * d, 0) / dists.length)) || 1

      let hLower = Math.round(cMean) - hStd
      let hUpper = Math.round(cMean) + hStd
      if (hLower < 0) hLower += 180
      if (hUpper >= 180) hUpper -= 180

      const sMeans = converted.map(c => c[1]!)
      const vMeans = converted.map(c => c[2]!)
      const sMean = Math.round(sMeans.reduce((a, b) => a + b, 0) / sMeans.length)
      const vMean = Math.round(vMeans.reduce((a, b) => a + b, 0) / vMeans.length)
      const sVariance = sMeans.reduce((a, b) => a + (b - sMean) ** 2, 0) / sMeans.length
      const vVariance = vMeans.reduce((a, b) => a + (b - vMean) ** 2, 0) / vMeans.length
      const sStd = Math.ceil(Math.sqrt(sVariance)) || 1
      const vStd = Math.ceil(Math.sqrt(vVariance)) || 1

      lower = [hLower, Math.max(sMean - sStd, 0), Math.max(vMean - vStd, 0)]
      upper = [hUpper, Math.min(sMean + sStd, 255), Math.min(vMean + vStd, 255)]
    } else {
      const sum = Array(channels).fill(0) as number[]
      for (const c of converted) {
        for (let i = 0; i < channels; i++) sum[i] += c[i]!
      }
      const mean = sum.map(s => Math.round(s / converted.length))

      const varianceSum = Array(channels).fill(0) as number[]
      for (const c of converted) {
        for (let i = 0; i < channels; i++) varianceSum[i] += (c[i]! - mean[i]!) ** 2
      }
      const std: number[] = varianceSum.map(v => Math.ceil(Math.sqrt(v / converted.length)))

      lower = mean.map((m, i) => Math.max(m - std[i]!, 0))
      upper = mean.map((m, i) => Math.min(m + std[i]!, channelMax(i, method)))
    }

    return { lower, upper }
  }
})

export type NumericRanges = { lower: number[][]; upper: number[][] }

/**
 * 把推荐范围按阈值扩展为可直接喂给 Pipeline 的数值区间。
 * HSV 色相环形（跨 0）或扩展后覆盖全色相时会输出多个 / 全区间，其余方法均为单区间。
 */
function expandRanges(
  method: ColorMethod,
  lower: number[],
  upper: number[],
  threshold: number
): NumericRanges {
  const t = threshold

  if (method === 40) {
    let hLower: number
    let hUpper: number

    if (lower[0]! > upper[0]!) {
      const origWidth = (upper[0]! - lower[0]! + 180) % 180
      const newWidth = origWidth + 2 * t
      if (newWidth >= 180) {
        hLower = 0
        hUpper = 179
      } else {
        hLower = (lower[0]! - t + 180) % 180
        hUpper = (hLower + newWidth) % 180
      }
    } else {
      hLower = Math.max(lower[0]! - t, 0)
      hUpper = Math.min(upper[0]! + t, 179)
    }

    const lRest = lower.slice(1).map(v => Math.max(v - t, 0))
    const uRest = upper.slice(1).map(v => Math.min(v + t, 255))

    if (hLower <= hUpper) {
      return {
        lower: [[hLower, ...lRest]],
        upper: [[hUpper, ...uRest]]
      }
    }
    return {
      lower: [
        [hLower, ...lRest],
        [0, ...lRest]
      ],
      upper: [
        [179, ...uRest],
        [hUpper, ...uRest]
      ]
    }
  }

  const lo = lower.map(v => Math.max(v - t, 0))
  const uo = upper.map((v, i) => Math.min(v + t, channelMax(i, method)))
  return {
    lower: [lo],
    upper: [uo]
  }
}

/** 采样推荐范围按阈值扩展后的数值形式，供快速匹配 ColorMatch 直接使用 */
export function recommendedRanges(threshold = 0): NumericRanges | null {
  if (!recommendedColors.value) {
    return null
  }
  return expandRanges(
    colorMethod.value,
    recommendedColors.value.lower,
    recommendedColors.value.upper,
    threshold
  )
}

function formatRangeText(
  method: ColorMethod,
  lower: number[],
  upper: number[],
  threshold?: number
): { lower: string; upper: string } {
  const ranges = expandRanges(method, lower, upper, threshold ?? 0)

  const format = (rs: number[][]) => {
    if (rs.length === 1) {
      return `[${rs[0]!.join(', ')}]`
    }
    return `[${rs.map(r => `[${r.join(', ')}]`).join(', ')}]`
  }

  return {
    lower: format(ranges.lower),
    upper: format(ranges.upper)
  }
}

export function recommendedLowerText(threshold?: number) {
  if (!recommendedColors.value) return undefined
  return formatRangeText(
    colorMethod.value,
    recommendedColors.value.lower,
    recommendedColors.value.upper,
    threshold
  ).lower
}

export function recommendedUpperText(threshold?: number) {
  if (!recommendedColors.value) return undefined
  return formatRangeText(
    colorMethod.value,
    recommendedColors.value.lower,
    recommendedColors.value.upper,
    threshold
  ).upper
}

export function copyRecommendedLower(threshold?: number) {
  const text = recommendedLowerText(threshold)
  if (text) ipc.send({ command: 'writeClipboard', text })
}

export function copyRecommendedUpper(threshold?: number) {
  const text = recommendedUpperText(threshold)
  if (text) ipc.send({ command: 'writeClipboard', text })
}
