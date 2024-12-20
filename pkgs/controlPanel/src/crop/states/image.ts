import { computed, ref, shallowRef } from 'vue'

import { ipc } from '@/crop/main'
import { Size } from '@/crop/utils/2d'

export const loadingCounter = ref<number>(0)
export const loading = computed(() => {
  return loadingCounter.value > 0
})

export const data = ref<string | null>(null)
export const element = shallowRef<HTMLImageElement | null>(null)
export const size = computed(() => {
  return element.value ? Size.from(element.value.width, element.value.height) : Size.from(0, 0)
})

export async function set(url: string) {
  ipc.log.info('imageSt.set called')

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
    ipc.log.error(`load image failed, ${err}`)
    data.value = null
    element.value = null
  }

  loadingCounter.value -= 1
}

export function screencap() {
  loadingCounter.value += 1

  ipc.postMessage({
    cmd: 'requestScreencap'
  })
}

export function upload() {
  loadingCounter.value += 1

  ipc.postMessage({
    cmd: 'requestUpload'
  })
}
