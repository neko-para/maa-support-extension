<script setup lang="ts">
import {
  NButton,
  NCard,
  NDropdown,
  NFlex,
  NInput,
  NInputNumber,
  NPopselect,
  NSelect,
  NText
} from 'naive-ui'
import type { DropdownMixedOption } from 'naive-ui/es/dropdown/src/interface'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, ref } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState, interfaceJson } from '../state'
import { makeBrief } from '../utils'

const controllerOptions = computed(() => {
  return (interfaceJson.value?.controller ?? [])
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
  const curr = hostState.value.interfaceConfigJson?.controller
  if (curr === '$fixed') {
    return -1
  }
  const index = interfaceJson.value?.controller?.findIndex(info => info.name === curr) ?? -1
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
  return interfaceJson.value?.controller?.[currentController.value] ?? null
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
  const opt = adbDevices.value[index]!
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
  const opt = desktopDevices.value[index]!
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

// ============ Linux ============

const linuxMeta = computed(() => {
  return (
    (
      currentControllerMeta.value as {
        linux?: { screencap?: string; input?: string; pipewire_source?: string }
      } | null
    )?.linux ?? {}
  )
})

// 与 buildControllerRuntime 的默认值保持一致（interface.json 未声明时按 Wlr 处理）
const linuxScreencap = computed(() => linuxMeta.value.screencap ?? 'Wlr')
const linuxInput = computed(() => linuxMeta.value.input ?? 'Wlr')

const needGamescope = computed(() => {
  return (
    (linuxScreencap.value === 'PipeWire' && linuxMeta.value.pipewire_source !== 'Portal') ||
    linuxInput.value === 'Libei'
  )
})

const needWlrSocket = computed(() => {
  return linuxScreencap.value === 'Wlr' || linuxInput.value === 'Wlr'
})

const needUInputSize = computed(() => {
  return linuxInput.value === 'UInput'
})

function configLinux(linux: {
  display_no?: number
  wlr_socket_path?: string
  uinput_screen_width?: number
  uinput_screen_height?: number
}) {
  ipc.send({
    command: 'configLinux',
    linux: {
      ...hostState.value.interfaceConfigJson?.linux,
      ...linux
    }
  })
}

const gamescopeInstances = ref<maa.GamescopeInstance[]>([])

const refreshingGamescope = ref(false)
const selectingGamescope = ref(false)

const gamescopeOptions = computed(() => {
  return gamescopeInstances.value.map((info, index) => {
    return {
      key: index,
      label: `Display ${info[0]}`
    } satisfies DropdownMixedOption
  })
})

async function refreshGamescope() {
  refreshingGamescope.value = true
  gamescopeInstances.value =
    ((await ipc.call({
      command: 'refreshGamescope'
    })) as maa.GamescopeInstance[] | null) ?? []
  refreshingGamescope.value = false
}

function configGamescope(index: number) {
  const opt = gamescopeInstances.value[index]!
  configLinux({
    display_no: opt[0]
  })
}

async function nativeSelectGamescope() {
  selectingGamescope.value = true
  const choice = (await ipc.call({
    command: 'showSelect',
    options: gamescopeInstances.value.map((info, index) => {
      return {
        value: index,
        title: `Display ${info[0]}`,
        subtitle: info[2]
      }
    })
  })) as number | null
  if (typeof choice === 'number') {
    configGamescope(choice)
  }
  selectingGamescope.value = false
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
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button
                :loading="refreshingAdb"
                :disabled="refreshingAdb || selectingAdb"
                @click="refreshAdb"
                size="small"
              >
                {{ t('maa.control.scan') }}
              </n-button>
            </template>
            {{ t('maa.control.tooltip.scan-adb') }}
          </Tooltip>
          <n-dropdown
            :disabled="refreshingAdb || selectingAdb || adbOptions.length === 0"
            trigger="hover"
            :options="adbOptions"
            @select="configAdb"
            size="small"
          >
            <Tooltip trigger="hover">
              <template #trigger>
                <n-button
                  :loading="selectingAdb"
                  :disabled="refreshingAdb || selectingAdb || adbOptions.length === 0"
                  size="small"
                  @click="nativeSelectAdb"
                >
                  {{ t('maa.control.controller.device-list') }}
                </n-button>
              </template>
              {{ t('maa.control.tooltip.device-list-adb') }}
            </Tooltip>
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
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button
                :loading="refreshingDesktop"
                :disabled="refreshingDesktop || selectingDesktop"
                @click="refreshDesktop"
                size="small"
              >
                {{ t('maa.control.scan') }}
              </n-button>
            </template>
            {{ t('maa.control.tooltip.scan-desktop') }}
          </Tooltip>
          <n-popselect
            :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
            trigger="hover"
            :options="desktopOptions"
            @update:value="v => configDesktop('win32', v)"
            size="small"
            scrollable
          >
            <Tooltip trigger="hover">
              <template #trigger>
                <n-button
                  :loading="selectingDesktop"
                  :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
                  size="small"
                  @click="nativeSelectDesktop('win32')"
                >
                  {{ t('maa.control.controller.window-list') }}
                </n-button>
              </template>
              {{ t('maa.control.tooltip.window-list-win32') }}
            </Tooltip>
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
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button
                :loading="refreshingDesktop"
                :disabled="refreshingDesktop || selectingDesktop"
                @click="refreshDesktop"
                size="small"
              >
                {{ t('maa.control.scan') }}
              </n-button>
            </template>
            {{ t('maa.control.tooltip.scan-desktop') }}
          </Tooltip>
          <n-popselect
            :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
            trigger="hover"
            :options="desktopOptions"
            @update:value="v => configDesktop('gamepad', v)"
            size="small"
            scrollable
          >
            <Tooltip trigger="hover">
              <template #trigger>
                <n-button
                  :loading="selectingDesktop"
                  :disabled="refreshingDesktop || selectingDesktop || desktopOptions.length === 0"
                  size="small"
                  @click="nativeSelectDesktop('gamepad')"
                >
                  {{ t('maa.control.controller.window-list') }}
                </n-button>
              </template>
              {{ t('maa.control.tooltip.window-list-gamepad') }}
            </Tooltip>
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
  <template v-if="currentType === 'Linux'">
    <n-card title="Linux" size="small">
      <n-flex v-if="linuxMeta.pipewire_source === 'Portal'" vertical>
        <n-text depth="3">{{ t('maa.control.linux.portal-unsupported') }}</n-text>
      </n-flex>
      <template v-if="needGamescope">
        <n-card title="Gamescope" size="small" embedded>
          <template #header-extra>
            <n-flex>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    :loading="refreshingGamescope"
                    :disabled="refreshingGamescope || selectingGamescope"
                    @click="refreshGamescope"
                    size="small"
                  >
                    {{ t('maa.control.scan') }}
                  </n-button>
                </template>
                {{ t('maa.control.tooltip.scan-gamescope') }}
              </Tooltip>
              <n-popselect
                :disabled="
                  refreshingGamescope || selectingGamescope || gamescopeOptions.length === 0
                "
                trigger="hover"
                :options="gamescopeOptions"
                @update:value="configGamescope"
                size="small"
              >
                <Tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      :loading="selectingGamescope"
                      :disabled="
                        refreshingGamescope || selectingGamescope || gamescopeOptions.length === 0
                      "
                      size="small"
                      @click="nativeSelectGamescope"
                    >
                      {{ t('maa.control.controller.display-list') }}
                    </n-button>
                  </template>
                  {{ t('maa.control.tooltip.display-list-gamescope') }}
                </Tooltip>
              </n-popselect>
            </n-flex>
          </template>
          <n-flex v-if="hostState.interfaceConfigJson?.linux?.display_no !== undefined" vertical>
            <span>
              {{ t('maa.control.linux.display-no') }}:
              {{ hostState.interfaceConfigJson.linux.display_no }}
            </span>
          </n-flex>
        </n-card>
      </template>
      <n-flex v-if="needWlrSocket" vertical>
        <n-input
          :value="hostState.interfaceConfigJson?.linux?.wlr_socket_path"
          @update:value="v => configLinux({ wlr_socket_path: v })"
          :placeholder="t('maa.control.linux.wlr-socket-placeholder')"
          size="small"
        ></n-input>
      </n-flex>
      <n-flex v-if="needUInputSize" vertical>
        <n-input-number
          :value="hostState.interfaceConfigJson?.linux?.uinput_screen_width"
          @update:value="v => configLinux({ uinput_screen_width: v ?? undefined })"
          :placeholder="t('maa.control.linux.uinput-width')"
          size="small"
        ></n-input-number>
        <n-input-number
          :value="hostState.interfaceConfigJson?.linux?.uinput_screen_height"
          @update:value="v => configLinux({ uinput_screen_height: v ?? undefined })"
          :placeholder="t('maa.control.linux.uinput-height')"
          size="small"
        ></n-input-number>
      </n-flex>
    </n-card>
  </template>
  <template v-if="currentType === 'Fixed'">
    <n-card title="VscFixed" size="small">
      <template #header-extra>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button @click="uploadImage" size="small">
              {{ t('maa.control.upload') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.upload-fixed') }}
        </Tooltip>
      </template>
      <n-flex v-if="hostState.interfaceConfigJson?.vscFixed" vertical>
        <span> {{ hostState.interfaceConfigJson.vscFixed.image }} </span>
      </n-flex>
    </n-card>
  </template>
</template>
