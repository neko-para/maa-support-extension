import { computed, ref } from 'vue'

import { ipc } from '../ipc'
import * as controlSt from './control'
import * as imageSt from './image'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const draw = ref(false)
export const drawType = ref<'all' | 'best' | 'filtered'>('all')

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

  controlSt.cropCeil()
  controlSt.cropBound()

  loading.value = true

  result.value = (await ipc.call({
    command: 'requestOCR',
    image: imageSt.data.value,
    roi: controlSt.cropBox.value.ceiled().flat()
  })) as string | null

  loading.value = false
}
