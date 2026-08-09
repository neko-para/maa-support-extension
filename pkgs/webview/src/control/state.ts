import { computed, ref } from 'vue'

import {
  type ControllerRuntime,
  type ControllerRuntimeBase,
  type ControllerRuntimeConstants,
  type Interface,
  type ResourceRuntime,
  buildControllerRuntime,
  buildResourceRuntime
} from '@nekosu/maa-pipeline-manager/logic'
import type { ControlHostState } from '@nekosu/maa-types'

export const hostState = ref<ControlHostState>({})
export const interfaceJson = ref<Interface>({})

// The control panel only checks whether a runtime can be built. The extension host rebuilds it
// with native constants before launch, so these values must be complete but need not be native.
const validationPlaceholder = '0' as maa.Uint64

const controllerRuntimeConstants = {
  Win32ScreencapMethod: {
    GDI: validationPlaceholder,
    FramePool: validationPlaceholder,
    DXGI_DesktopDup: validationPlaceholder,
    DXGI_DesktopDup_Window: validationPlaceholder,
    PrintWindow: validationPlaceholder,
    ScreenDC: validationPlaceholder,
    All: validationPlaceholder,
    Foreground: validationPlaceholder,
    Background: validationPlaceholder
  },
  Win32InputMethod: {
    Seize: validationPlaceholder,
    SendMessage: validationPlaceholder,
    PostMessage: validationPlaceholder,
    LegacyEvent: validationPlaceholder,
    PostThreadMessage: validationPlaceholder,
    SendMessageWithCursorPos: validationPlaceholder,
    PostMessageWithCursorPos: validationPlaceholder,
    SendMessageWithWindowPos: validationPlaceholder,
    PostMessageWithWindowPos: validationPlaceholder,
    Interception: validationPlaceholder
  },
  GamepadType: {
    Xbox360: validationPlaceholder,
    DualShock4: validationPlaceholder
  }
} satisfies ControllerRuntimeConstants

export const ctrlRtBase = computed<ControllerRuntimeBase | null>(() => {
  if (!interfaceJson.value || !hostState.value.interfaceConfigJson) {
    return null
  }
  if (hostState.value.interfaceConfigJson.controller === '$fixed') {
    return {
      name: '$fixed'
    }
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
  const rt = buildControllerRuntime(
    interfaceJson.value,
    hostState.value.interfaceConfigJson,
    controllerRuntimeConstants
  )
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
