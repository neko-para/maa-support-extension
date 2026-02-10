import { computed, ref, shallowRef } from 'vue'

import { ipc } from '../ipc'
import { Size } from '../utils/2d'
import * as controlSt from './control'

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

export async function set(url: string) {
  loadingCounter.value += 1

  const img = new Image()

  img.src = url
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    data.value = url
    element.value = img
  } catch (err) {
    data.value = null
    element.value = null
  }

  loadingCounter.value -= 1
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
    return [null, null]
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
