import { computed, ref } from 'vue'

import type { CropToolResult } from '@nekosu/maa-types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'
import * as controlSt from './control'
import * as imageSt from './image'
import * as pickSt from './pick'
import * as settingsSt from './settings'

export type MatchKind = 'ocr' | 'template' | 'color'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const resultKind = ref<MatchKind | null>(null)
export const error = ref<string | null>(null)
/** 最近一次发起的识别类型；失败信息只在对应的识别目标下展示 */
export const activeKind = ref<MatchKind | null>(null)

export const onlyRec = ref(false)
export const greenMask = ref(false)
export const method = ref<10001 | 3 | 5>(5)

export const colorCount = ref<number | null>(1)
export const colorConnected = ref(false)

export const resultObject = computed(() => {
  if (!result.value) {
    return null
  }

  const rawData = JSON.parse(result.value) as maa.RecoDetailWithoutDraws

  return rawData
})

/** 结果所属的图像；切图时丢弃，避免把旧图的识别框画到新图上 */
let resultImage: string | null = null

function applyResult(kind: MatchKind, image: string, resp: CropToolResult | null) {
  resultKind.value = kind
  result.value = resp?.detail ?? null
  error.value = resp?.failure?.message ?? null
  resultImage = image
}

/** 图像切换时由 image.ts 调用：丢掉不属于新图的结果 */
export function resetForImageChange(image: string) {
  if (resultImage === null || resultImage === image) {
    return
  }
  result.value = null
  resultKind.value = null
  error.value = null
  resultImage = null
}

export async function perform(type: 'requestOCR' | 'requestTemplateMatch') {
  const image = imageSt.data.value
  if (!image) {
    return
  }

  loading.value = true

  try {
    const resp = (await ipc.call({
      command: type,
      image,
      roi: controlSt.requestRoi(),
      only_rec: onlyRec.value,
      method: method.value,
      threshold: settingsSt.templateMatchThreshold.eff,
      green_mask: greenMask.value
    })) as CropToolResult | null

    if (resp === null) {
      // 用户取消选择模板文件，保留上一次的结果与提示
      return
    }
    if (imageSt.data.value !== image) {
      return
    }
    applyResult(type === 'requestOCR' ? 'ocr' : 'template', image, resp)
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}

export function run(kind: MatchKind) {
  activeKind.value = kind
  error.value = null
  switch (kind) {
    case 'ocr':
      return perform('requestOCR')
    case 'template':
      return perform('requestTemplateMatch')
    case 'color':
      return performColorMatch()
  }
}

export async function performColorMatch() {
  const image = imageSt.data.value
  if (!image) {
    return
  }

  const threshold = hostState.value.pickColorThreshold ?? 10
  const ranges = pickSt.recommendedRanges(threshold)
  if (!ranges) {
    error.value = t('maa.crop.tools.color-source-empty')
    return
  }

  loading.value = true

  try {
    const resp = (await ipc.call({
      command: 'requestColorMatch',
      image,
      options: {
        roi: controlSt.requestRoi(),
        method: pickSt.colorMethod.value,
        lower: ranges.lower,
        upper: ranges.upper,
        count: Math.max(Math.round(colorCount.value ?? 1), 1),
        connected: colorConnected.value
      }
    })) as CropToolResult | null
    if (imageSt.data.value !== image) {
      return
    }
    applyResult('color', image, resp)
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}
