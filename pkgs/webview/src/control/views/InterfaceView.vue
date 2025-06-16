<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect } from 'naive-ui'
import { computed, ref } from 'vue'

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
</script>

<template>
  <n-card title="配置" size="small">
    <template #header-extra>
      <n-button
        :loading="hostState.refreshingInterface"
        :disabled="hostState.refreshingInterface"
        @click="refreshInterface"
        size="small"
      >
        扫描
      </n-button>
    </template>
    <n-select
      :options="interfaceOptions"
      :value="hostState.activeInterface"
      :disabled="hostState.refreshingInterface"
      @update:value="switchInterface"
      size="small"
    ></n-select>
  </n-card>
</template>
