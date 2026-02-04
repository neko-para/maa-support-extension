<script setup lang="ts">
import { NButton, NCard, NDropdown, NFlex, NInput, NPopselect, NSelect } from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { makeBrief } from '../utils'

const controllerOptions = computed(() => {
  return (hostState.value.interfaceJson?.controller ?? [])
    .map((info, index) => {
      return {
        value: index,
        label: info.name
      } satisfies SelectMixedOption
    })
    .concat({
      value: -1,
      label: 'Fixed Image'
    })
})

const currentController = computed(() => {
  const curr = hostState.value.interfaceConfigJson?.controller?.name
  if (curr === '$fixed') {
    return -1
  }
  const index =
    hostState.value.interfaceJson?.controller?.findIndex(info => info.name === curr) ?? -1
  return index === -1 ? null : index
})

const currentControllerMeta = computed(() => {
  if (currentController.value === null) {
    return null
  }
  if (currentController.value === -1) {
    return {
      type: 'Fixed'
    } as {
      type: 'Fixed'
      adb?: never
      win32?: never
    }
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

const adbDevices = ref<maa.AdbDevice[]>([])

const refreshingAdb = ref(false)
const selectingAdb = ref(false)

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
    })) as maa.AdbDevice[] | null) ?? []
  refreshingAdb.value = false
}

function configAdb(index: number) {
  const opt = adbDevices.value[index]
  ipc.send({
    command: 'configAdb',
    adb: opt[1],
    address: opt[2],
    screencap: opt[3],
    input: opt[4],
    config: JSON.parse(opt[5])
  })
}

async function nativeSelectAdb() {
  selectingAdb.value = true
  const choice = (await ipc.call({
    command: 'showSelect',
    options: adbDevices.value.map((info, index) => {
      return {
        value: index,
        title: info[0],
        subtitle: `${info[1]} ${info[2]}`
      }
    })
  })) as number | null
  if (typeof choice === 'number') {
    configAdb(choice)
  }
  selectingAdb.value = false
}

const desktopDevices = ref<maa.DesktopDevice[]>([])
const currDeviceWin32 = computed(() => {
  return desktopDevices.value.find(
    info => info[0] === hostState.value.interfaceConfigJson?.win32?.hwnd
  )
})
const currDeviceGamepad = computed(() => {
  return desktopDevices.value.find(
    info => info[0] === hostState.value.interfaceConfigJson?.gamepad?.hwnd
  )
})

const refreshingDesktop = ref(false)
const selectingDesktop = ref(false)

const makeBriefDev = (dev: maa.DesktopDevice) => {
  return [dev[0], makeBrief(dev[1]), makeBrief(dev[2])].join('-')
}

const desktopOptions = computed(() => {
  return desktopDevices.value.map((info, index) => {
    return {
      value: index,
      label: makeBriefDev(info)
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
    ((await ipc.call({
      command: 'refreshDesktop'
    })) as maa.DesktopDevice[] | null) ?? []
  ).filter(info => {
    return filters.map(f => f(info)).reduce((a, b) => a && b, true)
  })
  refreshingDesktop.value = false
}

function configDesktop(type: 'win32' | 'gamepad', index: number) {
  const opt = desktopDevices.value[index]
  ipc.send({
    command: 'configDesktop',
    type,
    handle: opt[0]
  })
}

async function nativeSelectDesktop(type: 'win32' | 'gamepad') {
  selectingDesktop.value = true
  const choice = (await ipc.call({
    command: 'showSelect',
    options: desktopDevices.value.map((dev, index) => {
      return {
        value: index,
        title: `${dev[0]} ${dev[2]}`,
        subtitle: dev[1]
      }
    })
  })) as number | null
  if (typeof choice === 'number') {
    configDesktop(type, choice)
  }
  selectingDesktop.value = false
}

function configPlayCover(address: string) {
  ipc.send({
    command: 'configPlayCover',
    address
  })
}

function uploadImage() {
  ipc.send({
    command: 'uploadImage'
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
          <n-button
            :loading="refreshingAdb"
            :disabled="refreshingAdb || selectingAdb"
            @click="refreshAdb"
            size="small"
          >
            {{ t('maa.control.scan') }}
          </n-button>
          <n-dropdown
            :disabled="refreshingAdb || selectingAdb || adbOptions.length === 0"
            trigger="hover"
            :options="adbOptions"
            @select="configAdb"
            size="small"
          >
            <n-button
              :loading="selectingAdb"
              :disabled="refreshingAdb || selectingAdb || adbOptions.length === 0"
              size="small"
              @click="nativeSelectAdb"
            >
              {{ t('maa.control.controller.device-list') }}
            </n-button>
          </n-dropdown>
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
          <n-button
            :loading="refreshingDesktop"
            :disabled="refreshingDesktop || selectingDesktop"
            @click="refreshDesktop"
            size="small"
          >
            {{ t('maa.control.scan') }}
          </n-button>
          <n-popselect
            :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
            trigger="hover"
            :options="desktopOptions"
            @update:value="v => configDesktop('win32', v)"
            size="small"
            scrollable
          >
            <n-button
              :loading="selectingDesktop"
              :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
              size="small"
              @click="nativeSelectDesktop('win32')"
            >
              {{ t('maa.control.controller.window-list') }}
            </n-button>
          </n-popselect>
        </n-flex>
      </template>
      <n-flex v-if="hostState.interfaceConfigJson?.win32" vertical>
        <span> {{ hostState.interfaceConfigJson.win32.hwnd }} </span>
        <template v-if="currDeviceWin32">
          <span> {{ currDeviceWin32[1] }} </span>
          <span> {{ currDeviceWin32[2] }} </span>
        </template>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'PlayCover'">
    <n-card title="PlayCover" size="small">
      <n-flex vertical>
        <n-input
          :value="hostState.interfaceConfigJson?.playcover?.address"
          @update:value="configPlayCover"
          placeholder="address"
          size="small"
        ></n-input>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'Gamepad'">
    <n-card title="Gamepad" size="small">
      <template #header-extra>
        <n-flex>
          <n-button
            :loading="refreshingDesktop"
            :disabled="refreshingDesktop || selectingDesktop"
            @click="refreshDesktop"
            size="small"
          >
            {{ t('maa.control.scan') }}
          </n-button>
          <n-popselect
            :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
            trigger="hover"
            :options="desktopOptions"
            @update:value="v => configDesktop('gamepad', v)"
            size="small"
            scrollable
          >
            <n-button
              :loading="selectingDesktop"
              :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
              size="small"
              @click="nativeSelectDesktop('gamepad')"
            >
              {{ t('maa.control.controller.window-list') }}
            </n-button>
          </n-popselect>
        </n-flex>
      </template>
      <n-flex v-if="hostState.interfaceConfigJson?.gamepad" vertical>
        <span> {{ hostState.interfaceConfigJson.gamepad.hwnd }} </span>
        <template v-if="currDeviceGamepad">
          <span> {{ currDeviceGamepad[1] }} </span>
          <span> {{ currDeviceGamepad[2] }} </span>
        </template>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'Fixed'">
    <n-card title="VscFixed" size="small">
      <template #header-extra>
        <n-button @click="uploadImage" size="small">
          {{ t('maa.control.upload') }}
        </n-button>
      </template>
      <n-flex v-if="hostState.interfaceConfigJson?.vscFixed" vertical>
        <span> {{ hostState.interfaceConfigJson.vscFixed.image }} </span>
      </n-flex>
    </n-card>
  </template>
</template>
