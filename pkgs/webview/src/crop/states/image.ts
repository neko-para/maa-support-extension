import { computed, ref, shallowRef } from 'vue'

import type { CropImageResult, CropSaveResult } from '@nekosu/maa-types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { Size } from '../utils/2d'
import * as controlSt from './control'
import * as greenMaskSt from './greenMask'
import * as pickSt from './pick'
import * as matchSt from './quickMatch'
import * as recoSt from './reco'
import * as subjectSelectSt from './subjectSelect'

/** 按动作拆分 loading，避免点截图时上传/下载一起转圈 */
export const screencapLoading = ref(false)
export const uploadLoading = ref(false)
export const downloadLoading = ref(false)
/** 各动作最近一次的失败/成功信息；失败需要明确展示，不能与「未命中」混淆 */
export const screencapError = ref<string | null>(null)
export const uploadError = ref<string | null>(null)
export const saveError = ref<string | null>(null)
export const saveInfo = ref<string | null>(null)
export const savedPath = ref<string | null>(null)
export const savedRelativePath = ref<string | null>(null)
/** 保存的模板里是否有纯绿像素，决定复制的片段是否带 green_mask */
export const savedHasGreen = ref(false)
/** 空 ROI 时先提示，确认为保存整图后才真正落盘 */
export const emptyRoiWarning = ref(false)

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
  subjectSelectSt.resetForImageChange()
  matchSt.resetForImageChange(url)
  recoSt.resetForImageChange(url)
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

/** 载入新图并写入历史；解码失败时保留当前图像并返回 false，由调用方提示 */
export async function set(url: string) {
  let img: HTMLImageElement
  try {
    img = await loadImage(url)
  } catch {
    return false
  }
  commitImage(url, img)
  pushHistory(url, img)
  return true
}

/** 恢复一张已载入过的图像但不写入历史（用于撤销「应用涂绿」）；失败时保留当前图像 */
export async function restoreWithoutHistory(url: string) {
  try {
    const img = await loadImage(url)
    commitImage(url, img)
    // 恢复的图若仍在历史里，缩略图条高亮它；已被挤出历史时不高亮任何一项
    historyCursor.value = history.value.findIndex(e => e.image === url)
    return true
  } catch {
    return false
  }
}

export async function switchTo(index: number) {
  const entry = history.value[index]
  if (!entry || index === historyCursor.value) {
    return
  }
  try {
    const img = await loadImage(entry.image)
    commitImage(entry.image, img)
    historyCursor.value = index
  } catch (_err) {
    // 保留当前显示的图像，仅游标不动
  }
}

export async function screencap() {
  screencapLoading.value = true
  screencapError.value = null
  try {
    const resp = (await ipc.call({
      command: 'requestScreencap'
    })) as CropImageResult | null
    if (resp?.image) {
      if (!(await set(resp.image))) {
        screencapError.value = t('maa.crop.failure.decode')
      }
    } else {
      screencapError.value = resp?.failure?.message ?? t('maa.crop.failure.unknown')
    }
  } catch {
    screencapError.value = t('maa.crop.failure.unknown')
  } finally {
    screencapLoading.value = false
  }
}

export async function upload() {
  uploadLoading.value = true
  uploadError.value = null
  try {
    const resp = (await ipc.call({
      command: 'requestUpload'
    })) as CropImageResult | null
    if (resp === null) {
      // 用户取消选择文件
      return
    }
    if (resp.image) {
      if (!(await set(resp.image))) {
        uploadError.value = t('maa.crop.failure.decode')
      }
    } else {
      uploadError.value = resp.failure?.message ?? t('maa.crop.failure.unknown')
    }
  } catch {
    uploadError.value = t('maa.crop.failure.unknown')
  } finally {
    uploadLoading.value = false
  }
}

/** 区域内是否有纯绿 (0, 255, 0) 像素：MaaFramework 的 green_mask 只屏蔽这一种颜色 */
function containsPureGreen(rect: maa.Rect) {
  const img = element.value
  if (!img || rect[2] <= 0 || rect[3] <= 0) {
    return false
  }
  const canvas = document.createElement('canvas')
  canvas.width = rect[2]
  canvas.height = rect[3]
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3])
  const pixels = ctx.getImageData(0, 0, rect[2], rect[3]).data
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 0 && pixels[i + 1] === 255 && pixels[i + 2] === 0) {
      return true
    }
  }
  return false
}

export async function cropImage(): Promise<[string | null, maa.Rect | null]> {
  if (!data.value) {
    return [null, null]
  }

  const cropPos = controlSt.requestRoi()
  if (cropPos[2] === 0 || cropPos[3] === 0) {
    return [data.value, [0, 0, size.value.w, size.value.h]]
  }

  return [data.value, cropPos]
}

export async function download(force = false) {
  if (!force) {
    const roi = controlSt.requestRoi()
    if (roi[2] === 0 || roi[3] === 0) {
      emptyRoiWarning.value = true
      return
    }
  }
  emptyRoiWarning.value = false
  downloadLoading.value = true
  saveError.value = null
  saveInfo.value = null
  try {
    const [data, crop] = await cropImage()
    if (!data || !crop) {
      return
    }

    const hasGreen = containsPureGreen(crop)
    const resp = (await ipc.call({
      command: 'requestSave',
      image: data,
      crop,
      roi: controlSt.requestRoi(),
      expandRoi: controlSt.requestRoiExpand()
    })) as CropSaveResult | null

    if (resp === null) {
      // 用户取消命名/另存为
      return
    }
    if (resp.failure) {
      saveError.value = resp.failure.message
    } else if (resp.path) {
      savedPath.value = resp.path
      savedRelativePath.value = resp.relativePath ?? null
      savedHasGreen.value = hasGreen
      saveInfo.value = t('maa.crop.save.saved', resp.path)
    }
  } catch {
    saveError.value = t('maa.crop.failure.unknown')
  } finally {
    downloadLoading.value = false
  }
}

export function clearSaveInfo() {
  saveInfo.value = null
  savedPath.value = null
  savedRelativePath.value = null
  savedHasGreen.value = false
}

/** 保存成功后可一键复制 `template` 片段；仅在模板确实带绿幕时附加 green_mask */
export function copyTemplateSnippet() {
  const relative = savedRelativePath.value
  if (!relative) {
    return
  }
  const lines = [`"template": ${JSON.stringify(relative)},`]
  if (savedHasGreen.value) {
    lines.push('"green_mask": true')
  }
  ipc.send({ command: 'writeClipboard', text: lines.join('\n') })
}

export function cancelEmptyRoiWarning() {
  emptyRoiWarning.value = false
}

export function revealSaved() {
  if (savedPath.value) {
    ipc.send({ command: 'requestReveal', path: savedPath.value })
  }
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

  try {
    const newImage = (await ipc.call({
      command: 'resize',
      image: data.value,
      width,
      height
    })) as string | null
    if (newImage) {
      await set(newImage)
    }
  } finally {
    resizing.value = false
  }
}
