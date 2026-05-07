import { ref, shallowRef } from 'vue'

import * as imageSt from './image'

export const drawing = ref(false)
export const brushSize = ref(1)
export const isEraser = ref(false)

const maskCanvas = shallowRef<HTMLCanvasElement | null>(null)
const maskCtx = shallowRef<CanvasRenderingContext2D | null>(null)

const history: ImageData[] = []
const maxHistory = 50

export function init(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  maskCanvas.value = canvas
  maskCtx.value = ctx
  history.length = 0
}

export function clear() {
  if (maskCanvas.value && maskCtx.value) {
    saveHistory()
    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  }
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
  }
}

export function undo() {
  if (history.length > 0 && maskCanvas.value && maskCtx.value) {
    const imageData = history.pop()!
    maskCtx.value.putImageData(imageData, 0, 0)
  }
}

export function drawAt(x: number, y: number) {
  if (!maskCanvas.value || !maskCtx.value) return

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
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'
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
}

let isDrawingStroke = ref(false)

export function endStroke() {
  isDrawingStroke.value = false
}

export function getMaskCanvas(): HTMLCanvasElement | null {
  return maskCanvas.value
}

export function applyMask(): string | null {
  if (!imageSt.element.value || !maskCanvas.value) {
    return null
  }

  const img = imageSt.element.value
  const mask = maskCanvas.value

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const maskCtx2 = mask.getContext('2d')!
  const maskData = maskCtx2.getImageData(0, 0, mask.width, mask.height)

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (maskData.data[i + 3]! > 0) {
      imageData.data[i] = 0
      imageData.data[i + 1] = 255
      imageData.data[i + 2] = 0
      imageData.data[i + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}
