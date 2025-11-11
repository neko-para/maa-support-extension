<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect } from 'naive-ui'
import { computed } from 'vue'

import { controlViewState, localState } from '../../states/config'
import { request } from '../../utils/api'
import { t } from '../../utils/locale'

const interfaceOptions = computed(() => {
  return (controlViewState.value.interface ?? []).map(path => {
    return {
      value: path,
      label: path
    }
  })
})

function switchInterface(path: string) {
  request('/root/selectPath', {
    path
  })
}

function refreshInterface() {
  request('/root/refresh', {})
}

function revealConfig() {
  // ipc.send({
  //   command: 'revealConfig'
  // })
}
</script>

<template>
  <n-card :title="t('maa.control.interface.interface')" size="small">
    <template #header-extra>
      <n-flex>
        <n-button :disabled="!localState.activeInterface" @click="revealConfig" size="small">
          {{ t('maa.control.reveal-config') }}
        </n-button>
        <n-button
          :loading="controlViewState.refreshingInterface"
          :disabled="controlViewState.refreshingInterface"
          @click="refreshInterface"
          size="small"
        >
          {{ t('maa.control.scan') }}
        </n-button>
      </n-flex>
    </template>
    <n-select
      :options="interfaceOptions"
      :value="localState.activeInterface"
      :disabled="controlViewState.refreshingInterface"
      @update:value="switchInterface"
      :placeholder="t('maa.control.interface.select-interface')"
      size="small"
    ></n-select>
  </n-card>
</template>
