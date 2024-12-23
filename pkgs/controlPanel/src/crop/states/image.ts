import { Jimp } from 'jimp'
import { computed, ref, shallowRef } from 'vue'

import { ipc } from '@/crop/main'
import * as controlSt from '@/crop/states/control'
import { Size } from '@/crop/utils/2d'

export const loadingCounter = ref<number>(0)
export const loading = computed(() => {
  return loadingCounter.value > 0
})

export const data = ref<string | null>(null)
export const element = shallowRef<HTMLImageElement | null>(null)
export const size = computed(() => {
  return element.value ? Size.from(element.value.width, element.value.height) : Size.from(0, 0)
})

export async function set(url: string) {
  ipc.log.info('imageSt.set called')

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
    ipc.log.error(`load image failed, ${err}`)
    data.value = null
    element.value = null
  }

  loadingCounter.value -= 1
}

export function screencap() {
  loadingCounter.value += 1

  ipc.postMessage({
    cmd: 'requestScreencap'
  })
}

export function upload() {
  loadingCounter.value += 1

  ipc.postMessage({
    cmd: 'requestUpload'
  })
}

export async function cropImage() {
  if (!data.value) {
    return null
  }

  controlSt.cropCeil()
  controlSt.cropBound()

  const cropPos = controlSt.cropBox.value.flat()
  if (cropPos[2] === 0 || cropPos[3] === 0) {
    return null
  }

  const fullBuf = await (await fetch(data.value)).arrayBuffer()
  const full = await Jimp.read(fullBuf)
  const cropped = full.crop({
    x: cropPos[0],
    y: cropPos[1],
    w: cropPos[2],
    h: cropPos[3]
  })
  const croppedBuf = await cropped.getBuffer('image/png')
  return croppedBuf.toString('base64')
}

export async function download() {
  loadingCounter.value += 1

  const data = await cropImage()
  if (!data) {
    loadingCounter.value -= 1
    return
  }

  ipc.postMessage({
    cmd: 'requestSave',
    image: data,
    roi: controlSt.cropBox.value.flat(),
    expandRoi: controlSt.cropBoxExpand.value.flat()
  })
}
