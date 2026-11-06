import { computed, ref, shallowRef, watch } from 'vue'

import { type AutoMaskMethod, buildBackgroundMask } from '../utils/autoMaskCore'
import * as controlSt from './control'
import * as imageSt from './image'

/**
 * 自动涂绿：从工作区域（当前 ROI，未框选时为整图）的四边估计背景色，
 * 按容差做连通泛洪（或全图相似色），生成背景 mask；可外扩背景后应用。
 * 核心算法见 utils/autoMaskCore.ts（纯函数、可单测）。
 */
export type { AutoMaskMethod }

type RectTuple = [number, number, number, number]
type MaskResult = {
  result: ReturnType<typeof buildBackgroundMask>
  rect: RectTuple
}

export const method = ref<AutoMaskMethod>('border-grow')
export const tolerance = ref(24)
export const expand = ref(0)
export const enabled = ref(false)
export const previewCanvas = shallowRef<HTMLCanvasElement | null>(null)
/** 预览画布在整图中的左上角偏移，用于画布叠加 */
export const previewOffset = ref<[number, number]>([0, 0])
export const backgroundPixels = ref(0)
export const totalPixels = ref(0)
export const ratio = computed(() =>
  totalPixels.value > 0 ? (backgroundPixels.value / totalPixels.value) * 100 : 0
)
export const error = ref<string | null>(null)

let maskResult: MaskResult | null = null
let timer: ReturnType<typeof setTimeout> | undefined

/** 自动涂绿的工作区域：优先当前 ROI，未框选时退回整图 */
function workingRect(img: HTMLImageElement): RectTuple {
  const roi = controlSt.requestRoi()
  if (roi[2] > 0 && roi[3] > 0) {
    return [roi[0], roi[1], roi[2], roi[3]]
  }
  return [0, 0, img.width, img.height]
}

function readRegion(img: HTMLImageElement, rect: RectTuple) {
  const canvas = document.createElement('canvas')
  canvas.width = rect[2]
  canvas.height = rect[3]
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3])
  return { imageData: ctx.getImageData(0, 0, rect[2], rect[3]) }
}

function readImage(img: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx
}

function buildMask(img: HTMLImageElement, rect: RectTuple): MaskResult {
  const { imageData } = readRegion(img, rect)
  return {
    result: buildBackgroundMask(imageData.data, rect[2], rect[3], {
      method: method.value,
      tolerance: tolerance.value,
      expand: expand.value
    }),
    rect
  }
}

function renderPreview({ result, rect }: MaskResult) {
  const canvas = document.createElement('canvas')
  canvas.width = result.width
  canvas.height = result.height
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(result.width, result.height)
  for (let i = 0; i < result.mask.length; i++) {
    if (result.mask[i] === 1) {
      imageData.data[i * 4] = 0
      imageData.data[i * 4 + 1] = 255
      imageData.data[i * 4 + 2] = 0
      imageData.data[i * 4 + 3] = 150
    }
  }
  ctx.putImageData(imageData, 0, 0)
  previewCanvas.value = canvas
  previewOffset.value = [rect[0], rect[1]]
  backgroundPixels.value = result.backgroundPixels
  totalPixels.value = result.mask.length
}

export function clear() {
  previewCanvas.value = null
  previewOffset.value = [0, 0]
  maskResult = null
  backgroundPixels.value = 0
  totalPixels.value = 0
  error.value = null
}

export function refresh() {
  const img = imageSt.element.value
  if (!img) {
    clear()
    return
  }
  error.value = null
  try {
    const mask = buildMask(img, workingRect(img))
    maskResult = mask
    renderPreview(mask)
    const share = mask.result.backgroundPixels / (mask.result.width * mask.result.height)
    // 背景占比过低通常说明区域四边不是背景（例如框选太紧/UI 铺满），提示换方法/调容差
    if (share < 0.01) {
      error.value = 'empty'
    }
  } catch (err) {
    console.error('auto mask failed', err)
    clear()
    error.value = 'failed'
  }
}

/** 确保有最新 mask（应用前调用；ROI 变更后会按当前 ROI 重建） */
export function ensureMask(): MaskResult | null {
  refresh()
  return maskResult
}

/** 把背景 mask 烘焙成纯绿，返回图像 dataURL（只改工作区域内的像素） */
export function apply(): string | null {
  const img = imageSt.element.value
  const mask = ensureMask()
  if (!img || !mask || backgroundPixels.value === 0) {
    return null
  }

  const ctx = readImage(img)
  const { rect, result } = mask
  const region = ctx.getImageData(rect[0], rect[1], rect[2], rect[3])
  const data = region.data
  for (let i = 0; i < result.mask.length; i++) {
    if (result.mask[i] === 1) {
      const idx = i * 4
      data[idx] = 0
      data[idx + 1] = 255
      data[idx + 2] = 0
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(region, rect[0], rect[1])
  return ctx.canvas.toDataURL('image/png')
}

export function setEnabled(value: boolean) {
  enabled.value = value
  if (value) {
    refresh()
  } else {
    clear()
  }
}

function scheduleRefresh(delay = 180) {
  if (!enabled.value) {
    return
  }
  globalThis.clearTimeout(timer)
  timer = globalThis.setTimeout(() => {
    refresh()
  }, delay)
}

watch([method, tolerance, expand], () => scheduleRefresh(0))

// 拖动/输入 ROI 时预览跟随当前工作区域
watch(
  () => controlSt.cropBox.value,
  () => scheduleRefresh()
)

watch(
  () => imageSt.data.value,
  () => {
    maskResult = null
    if (enabled.value) {
      refresh()
    } else {
      clear()
    }
  }
)
