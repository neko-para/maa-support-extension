import { computed, ref } from 'vue'

import type { ControlHostState } from '@mse/types'

export const hostState = ref<ControlHostState>({})

export const controllerConfigured = computed(() => {
  if (!hostState.value.interfaceJson || !hostState.value.interfaceConfigJson) {
    return false
  }
  const controller = hostState.value.interfaceJson.controller?.find(
    info => info.name === hostState.value.interfaceConfigJson?.controller?.name
  )
  if (!controller) {
    return false
  }
  if (controller.type === 'Adb') {
    const adb = hostState.value.interfaceConfigJson.adb
    if (!adb) {
      return false
    }
    if (!adb.adb_path || !adb.address || !adb.config) {
      return false
    }
  } else {
    const win32 = hostState.value.interfaceConfigJson.win32
    if (!win32) {
      return false
    }
    if (!win32.hwnd) {
      return false
    }
  }
  return true
})

export const resourceConfigured = computed(() => {
  if (!hostState.value.interfaceJson || !hostState.value.interfaceConfigJson) {
    return false
  }
  const resource = hostState.value.interfaceJson.resource?.find(
    info => info.name === hostState.value.interfaceConfigJson?.resource
  )
  if (!resource) {
    return false
  }
  return true
})

export const taskConfigured = computed(() => {
  if (!hostState.value.interfaceJson || !hostState.value.interfaceConfigJson) {
    return false
  }
  for (const task of hostState.value.interfaceConfigJson?.task ?? []) {
    const taskMeta = hostState.value.interfaceJson.task?.find(info => info.name === task.name)
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
