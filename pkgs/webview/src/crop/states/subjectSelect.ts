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

export function start() {
  points.value = []
  drawing.value = false
  regionCanvas.value = null
  regionMask.value = null
  setMode('lasso')
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
