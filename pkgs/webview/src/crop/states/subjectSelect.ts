import { computed, ref, shallowRef, watch } from 'vue'

import { Pos } from '../utils/2d'
import { exitMode, mode, setMode } from './mode'

/**
 * 圈选主体：手画一圈（多边形）定义主体大概范围。
 * 区域作为「主体候选」，交给 subjectMask 用颜色模型细分主体/背景。
 */
export const points = ref<Pos[]>([])
export const drawing = ref(false)
/** 显示用区域叠加（半透明蓝） */
export const regionCanvas = shallowRef<HTMLCanvasElement | null>(null)
/** 算法用区域 mask（1=圈内），与整图同尺寸 */
export const regionMask = shallowRef<Uint8Array | null>(null)
export const hasRegion = computed(() => regionMask.value !== null)
export const active = computed(() => mode.value === 'lasso')

/**
 * 排除圈：圈选内再画的小圈，其中像素强制当背景（1=排除）。
 * 用来剔除镜面色块、和主体同色的背景碎片；与整图同尺寸，独立于 regionMask。
 */
export const excludeMask = shallowRef<Uint8Array | null>(null)
/** 排除区显示叠加（半透明红），与 excludeMask 同步重建 */
export const excludeCanvas = shallowRef<HTMLCanvasElement | null>(null)
/** 排除 mask 变更计数，maskApply 据此触发重新生成 */
export const excludeVersion = ref(0)
export const hasExclude = computed(() => excludeMask.value !== null)
/** 当前这笔圈选是「排除圈」而非主圈选 */
const refining = ref(false)

export function start() {
  points.value = []
  drawing.value = false
  regionCanvas.value = null
  regionMask.value = null
  excludeMask.value = null
  excludeCanvas.value = null
  refining.value = false
  setMode('lasso')
}

/** 在已有圈选上补充排除圈（不进 lasso 模式则没有画布捕获） */
export function startRefine() {
  if (!regionMask.value) {
    return
  }
  refining.value = true
  points.value = []
  drawing.value = false
  setMode('lasso')
}

export function clearExclude() {
  excludeMask.value = null
  excludeCanvas.value = null
  excludeVersion.value++
}

export function cancel() {
  drawing.value = false
  points.value = []
  if (mode.value === 'lasso') {
    exitMode()
  }
}

export function begin(pos: Pos) {
  points.value = [pos]
  drawing.value = true
}

export function extend(pos: Pos) {
  if (!drawing.value) {
    return
  }
  const last = points.value[points.value.length - 1]
  if (last && Math.abs(last.x - pos.x) + Math.abs(last.y - pos.y) < 2) {
    return
  }
  points.value = [...points.value, pos]
}

/** 把多边形烘到 excludeMask（与显示叠加），并把版本号 +1 触发重算 */
function finishExclude(shape: Path2D, width: number, height: number) {
  let mask = excludeMask.value
  if (!mask || mask.length !== width * height) {
    mask = new Uint8Array(width * height)
  }
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')!
  const img = maskCtx.createImageData(width, height)
  for (let i = 0; i < mask.length; i++) {
    img.data[i * 4 + 3] = mask[i] === 1 ? 255 : 0
  }
  maskCtx.putImageData(img, 0, 0)
  maskCtx.fillStyle = '#fff'
  maskCtx.fill(shape)
  const pixels = maskCtx.getImageData(0, 0, width, height).data
  for (let i = 0; i < mask.length; i++) {
    mask[i] = pixels[i * 4 + 3]! > 127 ? 1 : 0
  }
  excludeMask.value = mask

  // 半透明红叠加显示已排除区域
  const display = document.createElement('canvas')
  display.width = width
  display.height = height
  const displayCtx = display.getContext('2d')!
  const overlay = displayCtx.createImageData(width, height)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      overlay.data[i * 4] = 255
      overlay.data[i * 4 + 1] = 80
      overlay.data[i * 4 + 2] = 80
      overlay.data[i * 4 + 3] = 90
    }
  }
  displayCtx.putImageData(overlay, 0, 0)
  excludeCanvas.value = display
  excludeVersion.value++
}

export function finish(width: number, height: number) {
  if (!drawing.value) {
    return
  }
  drawing.value = false
  if (!width || !height || points.value.length < 3) {
    points.value = []
    return
  }

  const shape = new Path2D()
  const first = points.value[0]!
  shape.moveTo(first.x, first.y)
  for (const point of points.value.slice(1)) {
    shape.lineTo(point.x, point.y)
  }
  shape.closePath()

  if (refining.value) {
    finishExclude(shape, width, height)
    points.value = []
    exitMode()
    return
  }

  // 算法 mask
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.fillStyle = '#fff'
  maskCtx.fill(shape)
  const pixels = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data
  const mask = new Uint8Array(maskCanvas.width * maskCanvas.height)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = pixels[i * 4 + 3]! > 127 ? 1 : 0
  }

  // 显示叠加
  const display = document.createElement('canvas')
  display.width = width
  display.height = height
  const displayCtx = display.getContext('2d')!
  displayCtx.fillStyle = 'rgba(80, 160, 255, 0.32)'
  displayCtx.fill(shape)

  regionMask.value = mask
  regionCanvas.value = display
  points.value = []
  exitMode()
}

export function clear() {
  points.value = []
  drawing.value = false
  regionMask.value = null
  regionCanvas.value = null
  excludeMask.value = null
  excludeCanvas.value = null
  excludeVersion.value++
  refining.value = false
}

/** 图片切换/被替换时由 image.ts 调用：清掉旧圈选并退出圈选模式 */
export function resetForImageChange() {
  clear()
  if (mode.value === 'lasso') {
    exitMode()
  }
}

watch(mode, current => {
  if (current !== 'lasso' && drawing.value) {
    drawing.value = false
    points.value = []
  }
})
