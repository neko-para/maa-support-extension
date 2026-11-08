import { computed, ref, shallowRef, watch } from 'vue'

import { buildSubjectMask } from '../utils/subjectMaskCore'
import * as controlSt from './control'
import * as imageSt from './image'
import * as subjectSelectSt from './subjectSelect'

/**
 * 圈选主体 → 颜色模型生成绿幕：圈内按颜色区分主体/背景，圈外统一当背景。
 * 结果只在当前 ROI 内预览/应用，走与手动涂绿相同的应用/撤销路径。
 */
type RectTuple = [number, number, number, number]
type MaskResult = {
  result: ReturnType<typeof buildSubjectMask>
  rect: RectTuple
}

export const enabled = ref(false)
export const previewCanvas = shallowRef<HTMLCanvasElement | null>(null)
export const previewOffset = ref<[number, number]>([0, 0])
export const subjectPixels = ref(0)
export const totalPixels = ref(0)
/** 调试信息：背景容差、前景/背景样本数，绿不对时看是哪步丢了 */
export const debugInfo = ref<string>('')
export const subjectRatio = computed(() =>
  totalPixels.value > 0 ? (subjectPixels.value / totalPixels.value) * 100 : 0
)
export const error = ref<string | null>(null)
/** 主体偏置：>1 倾向保留主体（绿少），<1 倾向判背景（绿多）。拖滑杆即时重算 */
export const bias = ref(1.1)

let maskResult: MaskResult | null = null

/** 圈选 mask 在整图坐标下的包围盒 */
function regionBounds(region: Uint8Array, imgW: number, imgH: number): RectTuple | null {
  let minX = imgW
  let minY = imgH
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      if (region[y * imgW + x] !== 1) {
        continue
      }
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : [minX, minY, maxX - minX + 1, maxY - minY + 1]
}

/**
 * 工作区 = ROI ∪ 圈选包围盒（收进图像边界）。
 * 先框 ROI 再圈主体是最常见流程：圈在 ROI 内时结果不变；
 * 圈画出界一点时把工作区扩到刚好包住圈选，而不是退回整图。
 */
function workingRect(img: HTMLImageElement, region: Uint8Array): RectTuple {
  const roi = controlSt.requestRoi()
  const base: RectTuple =
    roi[2] > 0 && roi[3] > 0 ? [roi[0], roi[1], roi[2], roi[3]] : [0, 0, img.width, img.height]
  const bounds = regionBounds(region, img.width, img.height)
  if (!bounds) {
    return base
  }
  const x1 = Math.max(0, Math.min(base[0], bounds[0]))
  const y1 = Math.max(0, Math.min(base[1], bounds[1]))
  const x2 = Math.min(img.width, Math.max(base[0] + base[2], bounds[0] + bounds[2]))
  const y2 = Math.min(img.height, Math.max(base[1] + base[3], bounds[1] + bounds[3]))
  return [x1, y1, x2 - x1, y2 - y1]
}

function cropRegion(region: Uint8Array, imageWidth: number, rect: RectTuple) {
  const cropped = new Uint8Array(rect[2] * rect[3])
  for (let y = 0; y < rect[3]; y++) {
    for (let x = 0; x < rect[2]; x++) {
      cropped[y * rect[2] + x] = region[(rect[1] + y) * imageWidth + rect[0] + x] ?? 0
    }
  }
  return cropped
}

function readRegion(img: HTMLImageElement, rect: RectTuple) {
  const canvas = document.createElement('canvas')
  canvas.width = rect[2]
  canvas.height = rect[3]
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3])
  return { ctx, imageData: ctx.getImageData(0, 0, rect[2], rect[3]) }
}

function build(): MaskResult | null {
  const img = imageSt.element.value
  const region = subjectSelectSt.regionMask.value
  if (!img || !region) {
    error.value = 'no-region'
    return null
  }
  const rect = workingRect(img, region)
  const cropped = cropRegion(region, img.width, rect)
  const exclude = subjectSelectSt.excludeMask.value
  const excludeCropped = exclude ? cropRegion(exclude, img.width, rect) : undefined
  const { imageData } = readRegion(img, rect)
  const result = buildSubjectMask(imageData.data, rect[2], rect[3], cropped, {
    bias: bias.value,
    exclude: excludeCropped
  })
  if (result.backgroundSamples < 32) {
    error.value = 'bad-selection'
    return null
  }
  if (result.subjectPixels === 0 || result.subjectPixels === rect[2] * rect[3]) {
    error.value = 'bad-selection'
    return null
  }
  return { result, rect }
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
  subjectPixels.value = result.subjectPixels
  totalPixels.value = result.width * result.height
}

function clearPreview() {
  previewCanvas.value = null
  previewOffset.value = [0, 0]
  subjectPixels.value = 0
  totalPixels.value = 0
}

export function generate() {
  error.value = null
  const built = build()
  if (!built) {
    maskResult = null
    clearPreview()
    enabled.value = false
    return
  }
  maskResult = built
  renderPreview(built)
  debugInfo.value = `tol=${built.result.bgTolerance.toFixed(0)} fg=${built.result.foregroundSamples} bg=${built.result.backgroundSamples}`
  enabled.value = true
}

export function disable() {
  enabled.value = false
  maskResult = null
  error.value = null
  clearPreview()
}

/**
 * 把已生成的背景 mask 涂成纯绿写进整图像素（只改生成时的 ROI 内像素），
 * 返回是否改动了像素；只应用画布上正在预览的结果。
 */
export function paintInto(image: ImageData): boolean {
  if (!enabled.value || !maskResult) {
    return false
  }
  const { result, rect } = maskResult
  const data = image.data
  let painted = false
  for (let y = 0; y < rect[3]; y++) {
    for (let x = 0; x < rect[2]; x++) {
      if (result.mask[y * rect[2] + x] !== 1) {
        continue
      }
      const idx = ((rect[1] + y) * image.width + rect[0] + x) * 4
      data[idx] = 0
      data[idx + 1] = 255
      data[idx + 2] = 0
      data[idx + 3] = 255
      painted = true
    }
  }
  return painted
}

// 偏置滑杆变化时按当前圈选重算；生成是同步像素运算，80ms 防抖避免拖动卡帧
let biasTimer: ReturnType<typeof setTimeout> | null = null
watch(bias, () => {
  if (!maskResult) {
    return
  }
  if (biasTimer !== null) {
    clearTimeout(biasTimer)
  }
  biasTimer = setTimeout(() => {
    biasTimer = null
    generate()
  }, 80)
})

watch(
  () => imageSt.data.value,
  () => {
    maskResult = null
    clearPreview()
    enabled.value = false
  }
)
