<script setup lang="ts">
import type * as maa from '@maaxyz/maa-node'
import { NButton, NCard, NCode, NDropdown, NFlex, NSelect } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

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
</script>

<template>
  <n-card title="控制" size="small">
    <n-select
      :options="controllerOptions"
      :value="currentController"
      @update:value="switchController"
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
              设备列表
            </n-button>
          </n-dropdown>
          <n-button
            :loading="refreshingAdb"
            :disabled="refreshingAdb"
            @click="refreshAdb"
            size="small"
          >
            扫描
          </n-button>
        </n-flex>
      </template>
      <n-flex v-if="hostState.interfaceConfigJson?.adb" vertical>
        <span> {{ hostState.interfaceConfigJson.adb.adb_path }} </span>
        <span> {{ hostState.interfaceConfigJson.adb.address }} </span>
        <n-code
          language="json"
          :code="JSON.stringify(hostState.interfaceConfigJson.adb.config, null, 4)"
        ></n-code>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'Win32'"> win32! </template>
</template>
