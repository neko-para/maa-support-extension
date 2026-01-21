import { computed, ref, watch } from 'vue'

import { ipc } from '../ipc'
import { hostState } from '../state'
import * as controlSt from './control'
import * as imageSt from './image'

export const loading = ref(false)
export const result = ref<string | null>(null)
export const draw = ref(false)
export const drawType = ref<'all' | 'best' | 'filtered'>('all')
export const threshold = ref(0.8)

watch(
  () => hostState.value.templateMatchThreshold,
  value => {
    if (value !== undefined) {
      threshold.value = value
    }
  },
  { immediate: true }
)

watch(threshold, value => {
  if (value !== null && value !== undefined) {
    ipc.send({
      command: 'updateSettings',
      key: 'templateMatchThreshold',
      value
    })
  }
})

export const resultObject = computed(() => {
  if (!result.value) {
    return null
  }

  const rawData = JSON.parse(result.value) as maa.RecoDetailWithoutDraws

  return rawData
})

export async function perform(type: 'requestOCR' | 'requestTemplateMatch') {
  if (!imageSt.data.value) {
    return
  }

  controlSt.cropCeil()
  controlSt.cropBound()

  loading.value = true

  result.value = (await ipc.call({
    command: type,
    image: imageSt.data.value,
    roi: controlSt.cropBox.value.ceiled().flat(),
    threshold: threshold.value
  })) as string | null

  loading.value = false
}
