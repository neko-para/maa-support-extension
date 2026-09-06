import { computed, ref, shallowRef } from 'vue'

import { ipc } from '../ipc'
import { Size } from '../utils/2d'
import * as controlSt from './control'
import * as greenMaskSt from './greenMask'
import * as pickSt from './pick'

export const loadingCounter = ref<number>(0)
export const loading = computed(() => {
  return loadingCounter.value > 0
})

export const data = ref<string | null>(null)
export const element = shallowRef<HTMLImageElement | null>(null)
export const size = computed(() => {
  return element.value ? Size.from(element.value.width, element.value.height) : Size.from(0, 0)
})
export const resizing = ref(false)

export type HistoryEntry = {
  id: number
  image: string
  thumb: string
}

export const maxHistorySize = 5
export const history = ref<HistoryEntry[]>([])
export const historyCursor = ref(-1)
let historyId = 0

function makeThumb(img: HTMLImageElement): string {
  const maxDim = 64
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function commitImage(url: string, img: HTMLImageElement) {
  data.value = url
  element.value = img
  greenMaskSt.drawing.value = false
  greenMaskSt.reset()
  pickSt.clearSamplePoints()
  controlSt.cropBound()
}

function pushHistory(url: string, img: HTMLImageElement) {
  const existing = history.value.findIndex(e => e.image === url)
  if (existing !== -1) {
    historyCursor.value = existing
    return
  }
  history.value.push({
    id: ++historyId,
    image: url,
    thumb: makeThumb(img)
  })
  if (history.value.length > maxHistorySize) {
    history.value.shift()
  }
  historyCursor.value = history.value.length - 1
}

async function applyImage(url: string): Promise<boolean> {
  loadingCounter.value += 1
  try {
    const img = await loadImage(url)
    commitImage(url, img)
    return true
  } catch (_err) {
    data.value = null
    element.value = null
    return false
  } finally {
    loadingCounter.value -= 1
  }
}

export async function set(url: string) {
  if (await applyImage(url)) {
    pushHistory(url, element.value!)
  }
}

export async function switchTo(index: number) {
  const entry = history.value[index]
  if (!entry || index === historyCursor.value) {
    return
  }
  loadingCounter.value += 1
  try {
    const img = await loadImage(entry.image)
    commitImage(entry.image, img)
    historyCursor.value = index
  } catch (_err) {
    // 保留当前显示的图像，仅游标不动
  } finally {
    loadingCounter.value -= 1
  }
}

export async function screencap() {
  loadingCounter.value += 1

  const image = (await ipc.call({
    command: 'requestScreencap'
  })) as string | null

  if (image) {
    set(image)
  }

  loadingCounter.value -= 1
}

export async function upload() {
  loadingCounter.value += 1

  const image = (await ipc.call({
    command: 'requestUpload'
  })) as string | null

  if (image) {
    set(image)
  }

  loadingCounter.value -= 1
}

export async function cropImage(): Promise<[string | null, maa.Rect | null]> {
  if (!data.value) {
    return [null, null]
  }

  controlSt.cropCeil()
  controlSt.cropBound()

  const cropPos = controlSt.cropBox.value.flat()
  if (cropPos[2] === 0 || cropPos[3] === 0) {
    return [data.value, [0, 0, size.value.w, size.value.h]]
  }

  return [data.value, cropPos]
}

export async function download() {
  loadingCounter.value += 1

  const [data, crop] = await cropImage()
  if (!data || !crop) {
    loadingCounter.value -= 1
    return
  }

  await ipc.call({
    command: 'requestSave',
    image: data,
    crop,
    roi: controlSt.cropBox.value.flat(),
    expandRoi: controlSt.cropBoxExpand.value.flat()
  })
  loadingCounter.value -= 1
}

export async function resize() {
  if (!data.value || !size.value) {
    return
  }

  resizing.value = true

  let width: number
  let height: number
  if (size.value.w >= size.value.h) {
    width = 0
    height = 720
  } else {
    width = 720
    height = 0
  }

  const newImage = (await ipc.call({
    command: 'resize',
    image: data.value,
    width,
    height
  })) as string | null
  if (newImage) {
    set(newImage)
  }

  resizing.value = false
}
