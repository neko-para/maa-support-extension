import type * as maa from '@maaxyz/maa-node'
import { computed, ref } from 'vue'

import { ipc } from '../ipc'
import * as imageSt from './image'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const draw = ref(false)
export const drawType = ref<'all' | 'best' | 'filtered'>('all')

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

export async function perform() {
  if (!imageSt.data.value) {
    return
  }

  loading.value = true

  result.value = (await ipc.call({
    command: 'requestReco',
    image: imageSt.data.value
  })) as string | null

  loading.value = false
}
