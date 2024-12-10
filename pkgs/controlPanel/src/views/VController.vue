<script setup lang="ts">
import { JSONStringify } from 'json-with-bigint'
import { computed, ref } from 'vue'

import { VscButton, VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import { ipc } from '@/main'
import * as controllerSt from '@/states/controller'
import * as interfaceSt from '@/states/interface'

const currentAdbDevice = ref<string>('0')

const controllerOptions = computed<VscSingleSelectOption[]>(() => {
  return (
    interfaceSt.currentObj.value.controller?.map(i => {
      return {
        value: i.name,
        description: `${i.type}`
      } satisfies VscSingleSelectOption
    }) ?? []
  )
})

const adbDeviceOptions = computed<VscSingleSelectOption[]>(() => {
  return (
    ipc.context.value.adbDeviceList?.map((dev, idx) => {
      return {
        label: dev.name,
        value: `${idx}`,
        description: `${dev.address} - ${dev.adb_path}`
      } satisfies VscSingleSelectOption
    }) ?? []
  )
})

const currentControllerAdb = computed(() => {
  return interfaceSt.currentConfigObj.value.adb
})

function useAdbDevice() {
  if (/^\d+$/.test(currentAdbDevice.value ?? '')) {
    const idx = parseInt(currentAdbDevice.value)
    const dev = ipc.context.value.adbDeviceList?.[idx]
    if (dev) {
      if (ipc.context.value.interfaceConfigObj) {
        ipc.context.value.interfaceConfigObj.adb = {
          adb_path: dev.adb_path,
          address: dev.address,
          config: dev.config
        }
      } else {
        ipc.context.value.interfaceConfigObj = {
          adb: {
            adb_path: dev.adb_path,
            address: dev.address,
            config: dev.config
          }
        }
      }
    }
  }
}
</script>

<template>
  <div class="col-flex">
    <vsc-single-select
      v-model="controllerSt.currentName.value"
      :options="controllerOptions"
      :disabled="interfaceSt.freezed.value"
    ></vsc-single-select>
    <div v-if="controllerSt.currentProto.value?.type === 'Adb'" class="col-flex">
      <div class="row-flex">
        <vsc-single-select
          v-model="currentAdbDevice"
          :options="adbDeviceOptions"
          :disabled="interfaceSt.freezed.value"
        ></vsc-single-select>
        <vsc-button
          :loading="ipc.context.value.adbDeviceRefreshing"
          :disabled="interfaceSt.freezed.value || ipc.context.value.adbDeviceRefreshing"
          @click="controllerSt.refreshAdbDevice"
        >
          刷新
        </vsc-button>
        <vsc-button
          :loading="ipc.context.value.adbDeviceRefreshing"
          :disabled="interfaceSt.freezed.value || ipc.context.value.adbDeviceRefreshing"
          @click="useAdbDevice"
        >
          使用
        </vsc-button>
      </div>
      <div class="grid-form">
        <template v-if="currentControllerAdb?.adb_path">
          <span class="fixed">adb</span>
          <span> {{ currentControllerAdb.adb_path }} </span>
        </template>
        <template v-if="currentControllerAdb?.address">
          <span class="fixed">address</span>
          <span> {{ currentControllerAdb.address }} </span>
        </template>
        <template v-if="currentControllerAdb?.config">
          <span class="fixed">config</span>
          <span> {{ JSONStringify(currentControllerAdb.config) }} </span>
        </template>
      </div>
    </div>
    <div v-else-if="controllerSt.currentProto.value?.type === 'Win32'">Desktop配置 (未实现)</div>
  </div>
</template>
