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
export const draw = ref(false)
export const drawType = ref<'all' | 'best' | 'filtered'>('all')

export const onlyRec = ref(false)
export const greenMask = ref(false)
export const method = ref<10001 | 3 | 5>(5)
/** 用户最后选择的识别类型：参数区按它常驻展示，不必等第一次运行结果 */
export const selectedKind = ref<MatchKind>('template')

export const colorCount = ref<number | null>(1)
export const colorConnected = ref(false)

export const resultObject = computed(() => {
  if (!result.value) {
    return null
  }

  const rawData = JSON.parse(result.value) as maa.RecoDetailWithoutDraws

  return rawData
})

function applyResult(resp: CropToolResult | null) {
  result.value = resp?.detail ?? null
  error.value = resp?.failure?.message ?? null
}

export async function perform(type: 'requestOCR' | 'requestTemplateMatch') {
  if (!imageSt.data.value) {
    return
  }

  loading.value = true
  error.value = null
  resultKind.value = type === 'requestOCR' ? 'ocr' : 'template'

  try {
    const resp = (await ipc.call({
      command: type,
      image: imageSt.data.value,
      roi: controlSt.requestRoi(),
      only_rec: onlyRec.value,
      method: method.value,
      threshold: settingsSt.templateMatchThreshold.eff,
      green_mask: greenMask.value
    })) as CropToolResult | null

    if (resp === null) {
      // 用户取消选择模板文件，保留上一次结果
      return
    }
    applyResult(resp)
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}

export function runOcr() {
  selectedKind.value = 'ocr'
  return perform('requestOCR')
}

export function runTemplateMatch() {
  selectedKind.value = 'template'
  return perform('requestTemplateMatch')
}

export function runColorMatch() {
  selectedKind.value = 'color'
  return performColorMatch()
}

export async function performColorMatch() {
  if (!imageSt.data.value) {
    return
  }

  const threshold = hostState.value.pickColorThreshold ?? 10
  const ranges = pickSt.recommendedRanges(threshold)
  if (!ranges) {
    error.value = t('maa.crop.tools.color-source-empty')
    return
  }

  loading.value = true
  error.value = null
  resultKind.value = 'color'

  try {
    const resp = (await ipc.call({
      command: 'requestColorMatch',
      image: imageSt.data.value,
      options: {
        roi: controlSt.requestRoi(),
        method: pickSt.colorMethod.value,
        lower: ranges.lower,
        upper: ranges.upper,
        count: Math.max(Math.round(colorCount.value ?? 1), 1),
        connected: colorConnected.value
      }
    })) as CropToolResult | null
    applyResult(resp)
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}
