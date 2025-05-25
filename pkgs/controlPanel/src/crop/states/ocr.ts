import type * as maa from '@maaxyz/maa-node'
import { computed, ref } from 'vue'

import { ipc } from '@/crop/main'
import * as controlSt from '@/crop/states/control'
import * as imageSt from '@/crop/states/image'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const draw = ref(false)
export const drawType = ref<'all' | 'best' | 'filtered'>('all')

export type OcrDetailEntry = {
  box: maa.api.FlatRect
  score: number
  text: string
}

export const resultObject = computed(() => {
  if (!result.value) {
    return null
  }

  const rawData = JSON.parse(result.value) as {
    name: string
    algorithm: string
    hit: boolean
    box: maa.api.Rect
    detail: maa.RecoDetail
  }

  return rawData
})

export function perform() {
  if (!imageSt.data.value) {
    return
  }

  loading.value = true

  ipc.postMessage({
    cmd: 'requestOCR',
    image: imageSt.data.value,
    roi: controlSt.cropBox.value.ceiled().flat()
  })
}
