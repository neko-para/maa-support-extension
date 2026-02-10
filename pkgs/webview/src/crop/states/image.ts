import cvModule, { type CV } from '@techstark/opencv-js'
import { Jimp } from 'jimp'
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

async function getOpenCv(): Promise<{ cv: CV }> {
  let cv
  if (cvModule instanceof Promise) {
    cv = await cvModule
  } else {
    if (cvModule.Mat) {
      cv = cvModule
    } else {
      await new Promise<void>(resolve => {
        cvModule.onRuntimeInitialized = () => resolve()
      })
      cv = cvModule
    }
  }
  return { cv }
}

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
  if (!data.value) {
    return
  }
  resizing.value = true
  const buffer = await (await fetch(data.value)).arrayBuffer()
  const oldImg = await Jimp.read(Buffer.from(buffer))
  let targetW = 0
  let targetH = 0
  const expectSize = [1280, 720] as const
  if (oldImg.bitmap.width / oldImg.bitmap.height === 16 / 9) {
    targetW = expectSize[0]
    targetH = expectSize[1]
  } else if (oldImg.bitmap.width / oldImg.bitmap.height === 9 / 16) {
    targetW = expectSize[1]
    targetH = expectSize[0]
  } else {
    console.log('size not 16:9!')
    if (oldImg.bitmap.width > oldImg.bitmap.height) {
      targetW = (oldImg.bitmap.width * 720) / oldImg.bitmap.height
      targetH = 720
    } else {
      targetW = 720
      targetH = (oldImg.bitmap.height * 720) / oldImg.bitmap.width
    }
  }

  const { cv } = await getOpenCv()

  const mat = new cv.Mat(oldImg.bitmap.height, oldImg.bitmap.width, cv.CV_8UC4)
  mat.data.set(oldImg.bitmap.data)
  const dst = new cv.Mat()
  cv.resize(mat, dst, new cv.Size(targetW, targetH), 0, 0, cv.INTER_AREA)
  mat.delete()
  const newImg = new Jimp({ width: dst.cols, height: dst.rows })
  newImg.bitmap.data = Buffer.from(dst.data)
  dst.delete()
  const result = await newImg.getBase64('image/png')
  await set(result)
  resizing.value = false
}
