import { computed } from 'vue'

import type { Interface, InterfaceConfig, InterfaceRuntime } from '@mse/types'

import { ipc } from '@/control/main'

import * as runtimeSt from './runtime'

export function refresh() {
  ipc.postMessage({
    cmd: 'refreshInterface'
  })
}

export function launch() {
  const [rt, err] = runtimeSt.runtime.value
  if (rt) {
    launchRuntime(rt)
  }
}

export function stop() {
  ipc.postMessage({
    cmd: 'stopInterface'
  })
}

export function launchRuntime(runtime: InterfaceRuntime) {
  ipc.postMessage({
    cmd: 'launchInterface',
    runtime
  })
}

export const refreshing = computed(() => {
  return ipc.context.value.interfaceRefreshing ?? false
})

export const launching = computed(() => {
  return ipc.context.value.interfaceLaunching ?? false
})

export const freezed = computed(() => {
  return refreshing.value || launching.value
})

export const list = computed(() => {
  return ipc.context.value.interfaceList ?? []
})

export const currentName = computed<string | undefined>({
  set(v?: string) {
    if (v) {
      ipc.postMessage({
        cmd: 'selectInterface',
        interface: v
      })
    }
  },
  get() {
    return ipc.context.value.interfaceCurrent
  }
})

export const currentObj = computed<Partial<Interface>>(() => {
  if (!ipc.context.value.interfaceObj) {
    ipc.context.value.interfaceObj = {}
  }
  return ipc.context.value.interfaceObj
})

export const currentConfigObj = computed<Partial<InterfaceConfig>>(() => {
  if (!ipc.context.value.interfaceConfigObj) {
    ipc.context.value.interfaceConfigObj = {}
  }
  return ipc.context.value.interfaceConfigObj
})
