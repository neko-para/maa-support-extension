<script setup lang="ts">
import { NButton, NCard, NDynamicTags, NFlex, NText } from 'naive-ui'
import { ref } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'
import InputTask from './InputTask.vue'

const pauseLoading = ref(false)

function requestStop() {
  ipc.send({
    command: 'requestStop'
  })
}

async function togglePause() {
  pauseLoading.value = true
  if (hostState.value.paused) {
    await ipc.call({
      command: 'requestContinue'
    })
  } else {
    await ipc.call({
      command: 'requestPause'
    })
  }
  pauseLoading.value = false
}

function updateBreak(tasks: string[]) {
  ipc.send({
    command: 'updateBreakTasks',
    tasks: Array.from(new Set(tasks))
  })
}
</script>

<template>
  <n-card
    :title="t('maa.launch.process')"
    content-style="display: flex; flex-direction: column; gap: 10px;"
  >
    <template #header-extra>
      <n-flex>
        <n-button
          :loading="pauseLoading"
          :disabled="pauseLoading || hostState.stopped"
          @click="togglePause"
        >
          {{ hostState.paused ? t('maa.launch.continue') : t('maa.launch.pause') }}
        </n-button>
        <n-button :disabled="hostState.stopped" @click="requestStop">
          {{ t('maa.launch.stop') }}
        </n-button>
      </n-flex>
    </template>

    <n-flex vertical>
      <n-text size="small"> {{ t('maa.launch.add-breakpoint') }} </n-text>
      <n-dynamic-tags
        :value="hostState.breakTasks"
        @update:value="updateBreak"
        :color="{ color: 'transparent' }"
      >
        <template #input="{ submit, deactivate }">
          <input-task @submit="submit" @deactivate="deactivate"></input-task>
        </template>
      </n-dynamic-tags>
    </n-flex>
  </n-card>
</template>
