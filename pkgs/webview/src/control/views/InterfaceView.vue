<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect } from 'naive-ui'
import Tooltip from '../../components/Tooltip.vue'
import { computed } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const interfaceOptions = computed(() => {
  return (hostState.value.interface ?? []).map(path => {
    return {
      value: path,
      label: path
    }
  })
})

function switchInterface(path: string) {
  ipc.send({
    command: 'selectInterface',
    path
  })
}

function refreshInterface() {
  ipc.send({
    command: 'refreshInterface'
  })
}

function revealInterface() {
  ipc.send({
    command: 'revealInterface'
  })
}

function revealConfig() {
  ipc.send({
    command: 'revealConfig'
  })
}
</script>

<template>
  <n-card :title="t('maa.control.interface.interface')" size="small">
    <n-flex vertical>
      <n-select
        :options="interfaceOptions"
        :value="hostState.activeInterface"
        :disabled="hostState.refreshingInterface"
        @update:value="switchInterface"
        :placeholder="t('maa.control.interface.select-interface')"
        size="small"
      ></n-select>
      <n-flex>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button :disabled="!hostState.activeInterface" @click="revealInterface" size="small">
              {{ t('maa.control.reveal') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.reveal-interface') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button :disabled="!hostState.activeInterface" @click="revealConfig" size="small">
              {{ t('maa.control.reveal-config') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.reveal-config') }}
        </Tooltip>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button
              :loading="hostState.refreshingInterface"
              :disabled="hostState.refreshingInterface"
              @click="refreshInterface"
              size="small"
            >
              {{ t('maa.control.scan') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.scan-interface') }}
        </Tooltip>
      </n-flex>
    </n-flex>
  </n-card>
</template>
