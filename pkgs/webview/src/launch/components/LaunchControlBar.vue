<script setup lang="ts">
import { NButton, NCard, NDynamicTags, NFlex, NText } from 'naive-ui'
import { ref } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'
import InputTask from './InputTask.vue'

const pauseLoading = ref(false)
const showTool = ref(false)

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
    style="height: 100%"
    content-style="display: flex; flex-direction: column; gap: 10px;"
    size="small"
  >
    <template #header-extra>
      <n-flex>
        <n-button @click="showTool = !showTool" size="small">
          {{ t('maa.crop.tools') }}
        </n-button>
        <n-button
          :loading="pauseLoading"
          :disabled="pauseLoading || hostState.stopped"
          @click="togglePause"
          size="small"
        >
          {{ hostState.paused ? t('maa.launch.continue') : t('maa.launch.pause') }}
        </n-button>
        <n-button :disabled="hostState.stopped" @click="requestStop" size="small">
          {{ t('maa.launch.stop') }}
        </n-button>
      </n-flex>
    </template>

    <n-flex vertical style="height: 100%">
      <template v-if="showTool">
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
      </template>
      <slot></slot>
    </n-flex>
  </n-card>
</template>
