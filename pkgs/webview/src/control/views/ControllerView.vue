<script setup lang="ts">
import type * as maa from '@maaxyz/maa-node'
import { NButton, NCard, NDropdown, NFlex, NPopselect, NSelect } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const controllerOptions = computed(() => {
  return (hostState.value.interfaceJson?.controller ?? []).map((info, index) => {
    return {
      value: index,
      label: info.name
    } satisfies SelectMixedOption
  })
})

const currentController = computed(() => {
  const curr = hostState.value.interfaceConfigJson?.controller?.name
  const index =
    hostState.value.interfaceJson?.controller?.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

const currentControllerMeta = computed(() => {
  if (currentController.value === null) {
    return null
  }
  return hostState.value.interfaceJson?.controller?.[currentController.value] ?? null
})

const currentType = computed(() => {
  return currentControllerMeta.value?.type
})

function switchController(index: number) {
  ipc.send({
    command: 'selectController',
    index
  })
}

type AdbDevice = [
  name: string,
  adb_path: string,
  address: string,
  screencap_methods: maa.api.Uint64,
  input_methods: maa.api.Uint64,
  config: string
]

const adbDevices = ref<AdbDevice[]>([])

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
  adbDevices.value =
    ((await ipc.call({
      command: 'refreshAdb'
    })) as AdbDevice[] | null) ?? []
  refreshingAdb.value = false
}

function configAdb(index: number) {
  const opt = adbDevices.value[index]
  ipc.send({
    command: 'configAdb',
    adb: opt[1],
    address: opt[2],
    config: JSON.parse(opt[5])
  })
}

type DesktopDevice = [handle: maa.api.DesktopHandle, class_name: string, window_name: string]

const desktopDevices = ref<DesktopDevice[]>([])
const currDevice = computed(() => {
  return desktopDevices.value.find(
    info => info[0] === hostState.value.interfaceConfigJson?.win32?.hwnd
  )
})

const refreshingDesktop = ref(false)

const makeBrief = (dev: DesktopDevice) => {
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
  const filters: ((info: DesktopDevice) => boolean)[] = []
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
    ((await ipc.call({
      command: 'refreshDesktop'
    })) as DesktopDevice[] | null) ?? []
  ).filter(info => {
    return filters.map(f => f(info)).reduce((a, b) => a && b, true)
  })
  refreshingDesktop.value = false
}

function configDesktop(index: number) {
  const opt = desktopDevices.value[index]
  ipc.send({
    command: 'configDesktop',
    handle: opt[0]
  })
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
      <n-flex v-if="hostState.interfaceConfigJson?.adb" vertical>
        <span> {{ hostState.interfaceConfigJson.adb.adb_path }} </span>
        <span> {{ hostState.interfaceConfigJson.adb.address }} </span>
        <json-code
          :code="JSON.stringify(hostState.interfaceConfigJson.adb.config, null, 4)"
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
      <n-flex v-if="hostState.interfaceConfigJson?.win32" vertical>
        <span> {{ hostState.interfaceConfigJson.win32.hwnd }} </span>
        <template v-if="currDevice">
          <span> {{ currDevice[1] }} </span>
          <span> {{ currDevice[2] }} </span>
        </template>
      </n-flex>
    </n-card>
  </template>
</template>
