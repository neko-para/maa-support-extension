import { computed, ref } from 'vue'

import type { ControlHostState } from '@mse/types'
import {
  type ControllerRuntime,
  type ControllerRuntimeBase,
  type Interface,
  type ResourceRuntime,
  buildControllerRuntime,
  buildResourceRuntime
} from '@nekosu/maa-pipeline-manager/logic'

export const hostState = ref<ControlHostState>({})
export const interfaceJson = ref<Interface>({})

globalThis.maa = new Proxy(
  {},
  {
    get() {
      return new Proxy(
        {},
        {
          get() {
            return '0'
          }
        }
      )
    }
  }
) as typeof maa

export const ctrlRtBase = computed<ControllerRuntimeBase | null>(() => {
  if (!interfaceJson.value || !hostState.value.interfaceConfigJson) {
    return null
  }
  const info = interfaceJson.value.controller?.find(
    ctrl => ctrl.name === hostState.value.interfaceConfigJson?.controller
  )
  return info ?? null
})

export const ctrlRt = computed<{
  rt?: ControllerRuntime
  err?: string
}>(() => {
  if (!interfaceJson.value || !hostState.value.interfaceConfigJson) {
    return {}
  }
  const rt = buildControllerRuntime(interfaceJson.value, hostState.value.interfaceConfigJson)
  return typeof rt === 'string'
    ? {
        err: rt
      }
    : {
        rt
      }
})

export const resRt = computed<{
  rt?: ResourceRuntime
  err?: string
}>(() => {
  if (!interfaceJson.value || !hostState.value.interfaceConfigJson) {
    return {}
  }
  const rt = buildResourceRuntime(interfaceJson.value, hostState.value.interfaceConfigJson)
  return typeof rt === 'string'
    ? {
        err: rt
      }
    : {
        rt
      }
})

export const controllerConfigured = computed(() => {
  return !!ctrlRt.value.rt
})

export const resourceConfigured = computed(() => {
  return !!resRt.value.rt
})

export const taskConfigured = computed(() => {
  if (!interfaceJson.value || !hostState.value.interfaceConfigJson) {
    return false
  }
  for (const task of hostState.value.interfaceConfigJson?.task ?? []) {
    const taskMeta = interfaceJson.value.task?.find(info => info.name === task.name)
    if (!taskMeta) {
      return false
    }
  }
  return true
})

export const canLaunch = computed(() => {
  console.log(controllerConfigured.value, resourceConfigured.value, taskConfigured.value)
  return controllerConfigured.value && resourceConfigured.value && taskConfigured.value
})
