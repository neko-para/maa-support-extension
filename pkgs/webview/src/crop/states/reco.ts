import { computed, ref } from 'vue'

import type { CropToolResult } from '@nekosu/maa-types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
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

/** 结果所属的图像；切图时丢弃，避免把旧图的识别框画到新图上 */
let resultImage: string | null = null

export async function perform() {
  const image = imageSt.data.value
  if (!image) {
    return
  }

  loading.value = true

  try {
    const resp = (await ipc.call({
      command: 'requestReco',
      image
    })) as CropToolResult | null

    if (resp === null) {
      // 用户在节点 quick pick 中取消，保留上一次的结果与提示
      return
    }
    if (imageSt.data.value !== image) {
      // 识别期间切换了图像，结果已不对应当前画布
      return
    }

    result.value = resp.detail
    error.value = resp.failure?.message ?? null
    ran.value = true
    resultImage = image
  } catch {
    error.value = t('maa.crop.failure.unknown')
  } finally {
    loading.value = false
  }
}

/** 外部（启动面板 / 其他插件）送来的识别详情，归属于随它一起送来的图像 */
export function setExternal(detail: string, image: string | null) {
  result.value = detail
  error.value = null
  ran.value = true
  resultImage = image
}

/** 图像切换时由 image.ts 调用：丢掉不属于新图的结果 */
export function resetForImageChange(image: string) {
  if (resultImage === image) {
    return
  }
  result.value = null
  error.value = null
  ran.value = false
  resultImage = null
}
