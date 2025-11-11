<script setup lang="ts">
import { NButton, NCard, NDropdown, NFlex, NPopselect, NSelect } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import { controlViewState, localState } from '../../states/config'
import { request } from '../../utils/api'
import { t } from '../../utils/locale'
import JsonCode from '../JsonCode.vue'

const controllerOptions = computed(() => {
  return (controlViewState.value.interfaceJson?.controller ?? []).map((info, index) => {
    return {
      value: index,
      label: info.name
    } satisfies SelectMixedOption
  })
})

const currentController = computed(() => {
  const curr = localState.value.interfaceConfig?.controller?.name
  const index =
    controlViewState.value.interfaceJson?.controller?.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

const currentControllerMeta = computed(() => {
  if (currentController.value === null) {
    return null
  }
  return controlViewState.value.interfaceJson?.controller?.[currentController.value] ?? null
})

const currentType = computed(() => {
  return currentControllerMeta.value?.type
})

function switchController(index: number) {
  request('/interface/selectController', {
    index
  })
}

const adbDevices = ref<maa.AdbDevice[]>([])

const refreshingAdb = ref(false)

const adbOptions = computed(() => {
  return adbDevices.value.map((info, index) => {
    return {
      key: index,
      label: info[0]
    } satisfies DropdownMixedOption
  })
})

async function refreshAdb() {
  refreshingAdb.value = true
  adbDevices.value = (await request('/interface/native/refreshAdb', {}))?.devices ?? []
  refreshingAdb.value = false
}

function configAdb(index: number) {
  const opt = adbDevices.value[index]
  request('/interface/configAdb', {
    adb_path: opt[1],
    address: opt[2],
    config: JSON.parse(opt[5])
  })
}

const desktopDevices = ref<maa.DesktopDevice[]>([])
const currDevice = computed(() => {
  return desktopDevices.value.find(
    info => info[0] === localState.value.interfaceConfig?.win32?.hwnd
  )
})

const refreshingDesktop = ref(false)

const makeBrief = (dev: maa.DesktopDevice) => {
  return dev
    .map(x => {
      if (x.length > 10) {
        x = x.substring(0, 4) + '..' + x.substring(x.length - 4)
      }
      return x
    })
    .join('-')
}

const desktopOptions = computed(() => {
  return desktopDevices.value.map((info, index) => {
    return {
      value: index,
      label: makeBrief(info)
    } satisfies SelectMixedOption
  })
})

async function refreshDesktop() {
  const filters: ((info: maa.DesktopDevice) => boolean)[] = []
  if (currentControllerMeta.value?.win32?.class_regex) {
    const reg = new RegExp(currentControllerMeta.value?.win32?.class_regex)
    filters.push(info => {
      return reg.test(info[1])
    })
  }
  if (currentControllerMeta.value?.win32?.window_regex) {
    const reg = new RegExp(currentControllerMeta.value?.win32?.window_regex)
    filters.push(info => {
      return reg.test(info[2])
    })
  }
  refreshingDesktop.value = true
  desktopDevices.value = (
    (await request('/interface/native/refreshDesktop', {}))?.devices ?? []
  ).filter(info => {
    return filters.map(f => f(info)).reduce((a, b) => a && b, true)
  })
  refreshingDesktop.value = false
}

function configDesktop(index: number) {
  const opt = desktopDevices.value[index]
  request('/interface/configDesktop', {
    hwnd: opt[0]
  })
}

function uploadImage() {
  request('/interface/configVscFixed', {})
}
</script>

<template>
  <n-card :title="t('maa.control.controller.controller')" size="small">
    <n-select
      :options="controllerOptions"
      :value="currentController"
      @update:value="switchController"
      :placeholder="t('maa.control.controller.select-controller')"
      size="small"
    ></n-select>
  </n-card>

  <template v-if="currentType === 'Adb'">
    <n-card title="ADB" size="small">
      <template #header-extra>
        <n-flex>
          <n-dropdown
            :disabled="refreshingAdb || adbOptions.length === 0"
            trigger="hover"
            :options="adbOptions"
            @select="configAdb"
            size="small"
          >
            <n-button :disabled="refreshingAdb || adbOptions.length === 0" size="small">
              {{ t('maa.control.controller.device-list') }}
            </n-button>
          </n-dropdown>
          <n-button
            :loading="refreshingAdb"
            :disabled="refreshingAdb"
            @click="refreshAdb"
            size="small"
          >
            {{ t('maa.control.scan') }}
          </n-button>
        </n-flex>
      </template>
      <n-flex v-if="localState.interfaceConfig?.adb" vertical>
        <span> {{ localState.interfaceConfig.adb.adb_path }} </span>
        <span> {{ localState.interfaceConfig.adb.address }} </span>
        <json-code
          :code="JSON.stringify(localState.interfaceConfig.adb.config, null, 4)"
        ></json-code>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'Win32'">
    <n-card title="Win32" size="small">
      <template #header-extra>
        <n-flex>
          <n-popselect
            :disabled="refreshingDesktop || desktopOptions.length === 0"
            trigger="hover"
            :options="desktopOptions"
            @update:value="configDesktop"
            size="small"
            scrollable
          >
            <n-button :disabled="refreshingDesktop || desktopOptions.length === 0" size="small">
              {{ t('maa.control.controller.window-list') }}
            </n-button>
          </n-popselect>
          <n-button
            :loading="refreshingDesktop"
            :disabled="refreshingDesktop"
            @click="refreshDesktop"
            size="small"
          >
            {{ t('maa.control.scan') }}
          </n-button>
        </n-flex>
      </template>
      <n-flex v-if="localState.interfaceConfig?.win32" vertical>
        <span> {{ localState.interfaceConfig.win32.hwnd }} </span>
        <template v-if="currDevice">
          <span> {{ currDevice[1] }} </span>
          <span> {{ currDevice[2] }} </span>
        </template>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'VscFixed'">
    <n-card title="VscFixed" size="small">
      <template #header-extra>
        <n-button @click="uploadImage" size="small">
          {{ t('maa.control.upload') }}
        </n-button>
      </template>
      <n-flex v-if="localState.interfaceConfig?.vscFixed" vertical>
        <span> {{ localState.interfaceConfig.vscFixed.image }} </span>
      </n-flex>
    </n-card>
  </template>
</template>
