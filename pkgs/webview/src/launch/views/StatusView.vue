<script setup lang="ts">
import { NButton, NCard, NDynamicTags, NFlex, NScrollbar, NTab, NTabs, NText } from 'naive-ui'
import { ref } from 'vue'

import { t } from '../../utils/locale'
import InputTask from '../components/InputTask.vue'
import NextList from '../components/NextList.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { activeTask, followLast, taskList } from '../states/task'

function requestStop() {
  ipc.send({
    command: 'requestStop'
  })
}

const pauseLoading = ref(false)

async function toggleStop() {
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
    tasks: [...new Set(tasks)]
  })
}
</script>

<template>
  <n-card
    :title="t('maa.launch.process')"
    style="height: 100vh"
    content-style="display: flex; flex-direction: column; gap: 10px; min-height: 0"
  >
    <template #header-extra>
      <n-flex>
        <n-button
          :loading="pauseLoading"
          :disabled="pauseLoading || hostState.stopped"
          @click="toggleStop"
        >
          {{ hostState.paused ? t('maa.launch.continue') : t('maa.launch.pause') }}
        </n-button>
        <n-button :disabled="hostState.stopped" @click="followLast = !followLast">
          {{ t('maa.launch.follow') }}
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

    <n-tabs v-model:value="activeTask">
      <n-tab
        v-for="(info, index) in taskList.info"
        :key="index"
        :name="index"
        :label="info.info.entry"
      >
      </n-tab>
    </n-tabs>

    <n-scrollbar>
      <next-list
        style="min-height: 0"
        :items="taskList.info[activeTask as number].nexts"
      ></next-list>
    </n-scrollbar>
  </n-card>
</template>
