import { computed, ref, shallowRef, watch } from 'vue'

import { type AutoMaskMethod, buildBackgroundMask } from '../utils/autoMaskCore'
import * as imageSt from './image'

/**
 * 自动涂绿：从图像边缘估计背景色，按容差做连通泛洪（或全图相似色），
 * 生成背景 mask；可外扩背景后应用到图像（复用「应用涂绿」的撤销快照）。
 * 核心算法见 utils/autoMaskCore.ts（纯函数、可单测）。
 */
export type { AutoMaskMethod }

export const method = ref<AutoMaskMethod>('border-grow')
export const tolerance = ref(24)
export const expand = ref(0)
export const enabled = ref(false)
export const previewCanvas = shallowRef<HTMLCanvasElement | null>(null)
export const backgroundPixels = ref(0)
export const totalPixels = ref(0)
export const ratio = computed(() =>
  totalPixels.value > 0 ? (backgroundPixels.value / totalPixels.value) * 100 : 0
)
export const error = ref<string | null>(null)

type MaskResult = ReturnType<typeof buildBackgroundMask>

let maskResult: MaskResult | null = null

function readImage(img: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return { ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }
}

function buildMask(img: HTMLImageElement): MaskResult {
  const { imageData } = readImage(img)
  return buildBackgroundMask(imageData.data, img.width, img.height, {
    method: method.value,
    tolerance: tolerance.value,
    expand: expand.value
  })
}

function renderPreview(result: MaskResult) {
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
  backgroundPixels.value = result.backgroundPixels
  totalPixels.value = result.mask.length
}

export function clear() {
  previewCanvas.value = null
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
    const result = buildMask(img)
    maskResult = result
    renderPreview(result)
    const share = result.backgroundPixels / (result.width * result.height)
    // 背景占比过低通常说明边缘不是背景（例如游戏 UI 铺满四边），提示换方法/调容差
    if (share < 0.01) {
      error.value = 'empty'
    }
  } catch (err) {
    console.error('auto mask failed', err)
    clear()
    error.value = 'failed'
  }
}

/** 确保有最新 mask（应用前调用） */
export function ensureMask(): MaskResult | null {
  refresh()
  return maskResult
}

/** 把背景 mask 烘焙成纯绿，返回图像 dataURL */
export function apply(): string | null {
  const img = imageSt.element.value
  const result = ensureMask()
  if (!img || !result || backgroundPixels.value === 0) {
    return null
  }

  const { ctx, imageData } = readImage(img)
  const data = imageData.data
  for (let i = 0; i < result.mask.length; i++) {
    if (result.mask[i] === 1) {
      const idx = i * 4
      data[idx] = 0
      data[idx + 1] = 255
      data[idx + 2] = 0
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
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

watch([method, tolerance, expand], () => {
  if (enabled.value) {
    refresh()
  }
})

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
