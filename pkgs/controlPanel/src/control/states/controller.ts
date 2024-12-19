import { computed } from 'vue'

import { ipc } from '@/control/main'
import * as interfaceSt from '@/control/states/interface'

export function refreshAdbDevice() {
  ipc.postMessage({
    cmd: 'refreshAdbDevice'
  })
}

export function refreshDesktopWindow() {
  ipc.postMessage({
    cmd: 'refreshDesktopWindow'
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

export const filteredDesktopWindowList = computed(() => {
  let list = ipc.context.value.desktopWindowList ?? []
  if (currentProto.value?.win32?.window_regex) {
    const reg = new RegExp(currentProto.value.win32.window_regex)
    list = list.filter(x => reg.test(x.window_name))
  }
  if (currentProto.value?.win32?.class_regex) {
    const reg = new RegExp(currentProto.value.win32.class_regex)
    list = list.filter(x => reg.test(x.class_name))
  }
  return list
})
