import { computed, ref, shallowRef, triggerRef, watch } from 'vue'

import * as imageSt from './image'
import { exitMode, mode, setMode } from './mode'

/** 涂绿模式是画布单一模式的一种，由 mode 派生 */
export const drawing = computed({
  get: () => mode.value === 'mask',
  set: active => {
    if (active) {
      setMode('mask')
    } else if (mode.value === 'mask') {
      exitMode()
    }
  }
})

// 离开涂绿模式时结束当前笔画，避免半截笔画继续吃掉后续事件
watch(mode, current => {
  if (current !== 'mask') {
    endStroke()
  }
})
// 1px 画笔在未放大的画布上几乎看不见，默认给一个能看清的粗细
export const brushSize = ref(6)
export const isEraser = ref(false)

/**
 * 生成绿幕的方式：手动涂抹 / 自动去背景 / 圈选主体。
 * 三种方式共用一个「应用到图像」：画布上看到的绿色会一起烘焙进图像。
 */
export type MaskMethod = 'manual' | 'auto' | 'lasso'
export const method = ref<MaskMethod>('manual')

/** 是否至少画过一笔（用于模板匹配参数区提示与 green_mask 联动） */
export const hasContent = ref(false)
/** 「应用」把绿幕烘焙进图像前的快照，用于撤销应用 */
export const appliedFrom = ref<string | null>(null)

const maskCanvas = shallowRef<HTMLCanvasElement | null>(null)
const maskCtx = shallowRef<CanvasRenderingContext2D | null>(null)

const history: ImageData[] = []
const maxHistory = 50
/** 可撤销的步数；清除后仍可撤销，所以不能用 hasContent 判断 */
export const undoSteps = ref(0)

/**
 * 为当前图像准备空白的手绘蒙版。不动 appliedFrom：应用后再进入涂绿修补时，
 * 「撤销应用」仍要能回到应用前的图像。
 */
export function init(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  maskCanvas.value = canvas
  maskCtx.value = ctx
  history.length = 0
  undoSteps.value = 0
  hasContent.value = false
}

/** 进入涂抹前调用：已有同尺寸蒙版时保留笔画，退出后再进入可以接着画 */
export function ensure(width: number, height: number) {
  const canvas = maskCanvas.value
  if (!canvas || canvas.width !== width || canvas.height !== height) {
    init(width, height)
  }
}

/** 进入涂抹模式（缺少蒙版时按当前图像尺寸创建） */
export function start() {
  const img = imageSt.element.value
  if (!img) {
    return
  }
  ensure(img.width, img.height)
  setMode('mask')
}

export function clear() {
  if (maskCanvas.value && maskCtx.value) {
    saveHistory()
    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    triggerRef(maskCanvas)
    hasContent.value = false
  }
}

export function reset() {
  maskCanvas.value = null
  maskCtx.value = null
  history.length = 0
  undoSteps.value = 0
  isDrawingStroke.value = false
  hasContent.value = false
  appliedFrom.value = null
}

function saveHistory() {
  if (maskCanvas.value && maskCtx.value) {
    const imageData = maskCtx.value.getImageData(
      0,
      0,
      maskCanvas.value.width,
      maskCanvas.value.height
    )
    history.push(imageData)
    if (history.length > maxHistory) {
      history.shift()
    }
    undoSteps.value = history.length
  }
}

export function undo() {
  if (history.length > 0 && maskCanvas.value && maskCtx.value) {
    const imageData = history.pop()!
    undoSteps.value = history.length
    maskCtx.value.putImageData(imageData, 0, 0)
    triggerRef(maskCanvas)
    // 撤销到第一笔之前时蒙版为空，「应用」不应再可用
    hasContent.value = imageData.data.some((value, idx) => idx % 4 === 3 && value > 0)
  }
}

export function drawAt(x: number, y: number) {
  if (!maskCanvas.value || !maskCtx.value) return
  hasContent.value = true

  if (history.length === 0 || !isDrawingStroke.value) {
    saveHistory()
    isDrawingStroke.value = true
  }

  const ctx = maskCtx.value
  const size = brushSize.value
  const radius = size / 2

  if (isEraser.value) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgb(0, 255, 0)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const left = Math.max(Math.floor(x - radius - 1), 0)
  const top = Math.max(Math.floor(y - radius - 1), 0)
  const right = Math.min(Math.ceil(x + radius + 1), maskCanvas.value.width)
  const bottom = Math.min(Math.ceil(y + radius + 1), maskCanvas.value.height)
  const w = right - left
  const h = bottom - top
  if (w > 0 && h > 0) {
    const imageData = ctx.getImageData(left, top, w, h)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = imageData.data[i + 3]! > 127 ? 255 : 0
    }
    ctx.putImageData(imageData, left, top)
  }
  triggerRef(maskCanvas)
}

const isDrawingStroke = ref(false)

export function endStroke() {
  isDrawingStroke.value = false
}

export function getMaskCanvas(): HTMLCanvasElement | null {
  return maskCanvas.value
}

/** 记录应用前的图像，供「撤销应用」恢复 */
export function markApplied(previousImage: string | null) {
  appliedFrom.value = previousImage
}

export function markRestored() {
  appliedFrom.value = null
}

/**
 * 把手绘蒙版涂成纯绿写进整图像素（尺寸须与蒙版一致），返回是否改动了像素。
 * 应用由 maskApply 统一组装，与自动去背景/圈选主体的结果叠加后一次烘焙。
 */
export function paintInto(image: ImageData): boolean {
  const mask = maskCanvas.value
  if (!mask || !hasContent.value || mask.width !== image.width || mask.height !== image.height) {
    return false
  }
  const maskData = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data
  const data = image.data
  let painted = false
  for (let i = 0; i < data.length; i += 4) {
    if (maskData[i + 3]! > 0) {
      data[i] = 0
      data[i + 1] = 255
      data[i + 2] = 0
      data[i + 3] = 255
      painted = true
    }
  }
  return painted
}
