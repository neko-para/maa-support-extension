import { computed } from 'vue'

import { ipc } from '@/main'
import * as interfaceSt from '@/states/interface'

export function refreshAdbDevice() {
  ipc.postMessage({
    cmd: 'refreshAdbDevice'
  })
}

export const currentName = computed<string | undefined>({
  set(v?: string) {
    if (!interfaceSt.currentObj.value.controller?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      interfaceSt.currentConfigObj.value.controller = {
        name: v
      }
    }
  },
  get() {
    return interfaceSt.currentConfigObj.value.controller?.name
  }
})

export const currentProto = computed(() => {
  return interfaceSt.currentObj.value.controller?.find(x => x.name === currentName.value)
})
