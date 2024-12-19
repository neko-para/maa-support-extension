import { computed } from 'vue'

import * as interfaceSt from '@/control/states/interface'

export const currentName = computed<string | undefined>({
  set(v?: string) {
    if (!interfaceSt.currentObj.value.resource?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      interfaceSt.currentConfigObj.value.resource = v
    }
  },
  get() {
    return interfaceSt.currentConfigObj.value.resource
  }
})

export const currentProto = computed(() => {
  return interfaceSt.currentObj.value.resource?.find(x => x.name === currentName.value)
})
