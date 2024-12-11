<script setup lang="ts">
import type * as maa from '@maaxyz/maa-node'
import { computed, ref } from 'vue'

import { VscButton, VscSingleSelect, type VscSingleSelectOption } from '@/components/VscEl'
import { ipc } from '@/main'
import * as controllerSt from '@/states/controller'
import * as interfaceSt from '@/states/interface'

const currentAdbDevice = ref<string>('0')
const currentDesktopWindow = ref<string | undefined>(undefined)

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

const desktopWindowOptions = computed<VscSingleSelectOption[]>(() => {
  return controllerSt.filteredDesktopWindowList.value.map((dev, idx) => {
    return {
      label: dev.window_name,
      value: dev.hwnd,
      description: dev.class_name
    } satisfies VscSingleSelectOption
  })
})

const currentControllerAdb = computed(() => {
  return interfaceSt.currentConfigObj.value.adb
})

const currentControllerDesktop = computed(() => {
  return interfaceSt.currentConfigObj.value.win32
})

function useAdbDevice() {
  if (/^\d+$/.test(currentAdbDevice.value ?? '')) {
    const idx = parseInt(currentAdbDevice.value)
    const dev = ipc.context.value.adbDeviceList?.[idx]
    if (dev) {
      interfaceSt.currentConfigObj.value.adb = {
        adb_path: dev.adb_path,
        address: dev.address,
        config: dev.config
      }
    }
  }
}

function useDesktopWindow() {
  interfaceSt.currentConfigObj.value.win32 = {
    hwnd: currentDesktopWindow.value as maa.api.DesktopHandle
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
      <div v-if="currentControllerAdb?.adb_path && currentControllerAdb.address" class="grid-form">
        <span class="fixed">adb</span>
        <span> {{ currentControllerAdb.adb_path }} </span>
        <span class="fixed">address</span>
        <span> {{ currentControllerAdb.address }} </span>
        <template v-if="currentControllerAdb.config">
          <span class="fixed">config</span>
          <span> {{ JSON.stringify(currentControllerAdb.config) }} </span>
        </template>
      </div>
      <span v-else> Adb 未配置 </span>
    </div>
    <div v-if="controllerSt.currentProto.value?.type === 'Win32'" class="col-flex">
      <div class="row-flex">
        <vsc-single-select
          v-model="currentDesktopWindow"
          :options="desktopWindowOptions"
          :disabled="interfaceSt.freezed.value"
        ></vsc-single-select>
        <vsc-button
          :loading="ipc.context.value.adbDeviceRefreshing"
          :disabled="interfaceSt.freezed.value || ipc.context.value.desktopWindowRefreshing"
          @click="controllerSt.refreshDesktopWindow"
        >
          刷新
        </vsc-button>
        <vsc-button
          :loading="ipc.context.value.adbDeviceRefreshing"
          :disabled="interfaceSt.freezed.value || ipc.context.value.desktopWindowRefreshing"
          @click="useDesktopWindow"
        >
          使用
        </vsc-button>
      </div>
      <div v-if="currentControllerDesktop?.hwnd" class="grid-form">
        <span class="fixed">hwnd</span>
        <span> {{ currentControllerDesktop.hwnd }} </span>
      </div>
      <span v-else> Desktop 未配置 </span>
    </div>
  </div>
</template>
