import { computed, ref } from 'vue'

import type { CropToolResult } from '@nekosu/maa-types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import * as controlSt from './control'
import * as imageSt from './image'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const error = ref<string | null>(null)
/** 是否已经执行过识别（用于区分「未执行」与「执行了但未命中」） */
export const ran = ref(false)

export const resultObject = computed(() => {
  if (!result.value) {
    return null
  }

  const rawData = JSON.parse(result.value) as maa.RecoDetailWithoutDraws

  return rawData
})

export async function perform() {
  if (!imageSt.data.value) {
    return
  }

  loading.value = true
  error.value = null

  try {
    const resp = (await ipc.call({
      command: 'requestReco',
      image: imageSt.data.value
    })) as CropToolResult | null

    if (resp === null) {
      // 用户在节点 quick pick 中取消，保留上一次结果
      return
    }

    result.value = resp.detail
    error.value = resp.failure?.message ?? null
    ran.value = true
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}
