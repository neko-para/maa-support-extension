<script setup lang="ts">
import { NButton, NCard, NDynamicTags, NFlex, NScrollbar, NTab, NTabs, NText } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'

import { t } from '../../utils/locale'
import InputTask from '../components/InputTask.vue'
import NodeScopeItem from '../components/NodeScopeItem.vue'
import TaskScopeItem from '../components/TaskScopeItem.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { type LaunchGraph, afterLaunchGraph, launchGraph } from '../states/launch'

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

const followLast = ref(true)
const selectTask = ref(0)
const activeTask = computed<number>({
  get() {
    if (followLast.value && !hostState.value.stopped) {
      return launchGraph.value.childs.length > 0 ? launchGraph.value.childs.length - 1 : 0
    } else {
      return selectTask.value
    }
  },
  set(v) {
    selectTask.value = v
    followLast.value = false
  }
})

const scrollEl = ref<InstanceType<typeof NScrollbar> | null>(null)
onMounted(() => {
  afterLaunchGraph.value = () => {
    if (followLast.value) {
      scrollEl.value?.scrollTo({
        top: Number.MAX_SAFE_INTEGER,
        behavior: 'smooth'
      })
    }
  }
})
onUnmounted(() => {
  afterLaunchGraph.value = () => {}
})
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
          {{ followLast ? t('maa.launch.following') : t('maa.launch.follow') }}
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
        v-for="(info, index) in launchGraph.childs"
        :key="index"
        :name="index"
        :label="info.msg.entry"
      >
      </n-tab>
    </n-tabs>

    <n-scrollbar v-if="activeTask < launchGraph.childs.length" ref="scrollEl">
      <task-scope-item :item="launchGraph.childs[activeTask]"></task-scope-item>
    </n-scrollbar>
  </n-card>
</template>
