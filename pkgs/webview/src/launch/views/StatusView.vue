<script setup lang="ts">
import { NButton, NCard, NDynamicTags, NFlex, NTab, NTabs, NText } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'

import { t } from '../../utils/locale'
import { DynamicScroller, DynamicScrollerItem } from '../../utils/vvs'
import InputTask from '../components/InputTask.vue'
import StatusRow from '../components/StatusRow.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { activeTask, followLast, taskList } from '../states/task'

let resizeObs: ResizeObserver
const sizingEl = ref<HTMLDivElement | null>(null)
const size = ref<[number, number]>([0, 0])
const sizeStyle = computed(() => {
  return `position: absolute; left: 0; top: 0; width: ${size.value[0]}px; height: ${size.value[1]}px`
})

watch(
  () => sizingEl.value,
  () => {
    const resize = () => {
      const rec = sizingEl.value!.getBoundingClientRect()
      size.value = [rec.width, rec.height]
    }
    resizeObs = new ResizeObserver(resize)
    resizeObs.observe(sizingEl.value!)
    resize()
  },
  {
    once: true
  }
)

onUnmounted(() => {
  resizeObs.disconnect()
})

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
    content-style="display: flex; flex-direction: column; gap: 10px"
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

    <div ref="sizingEl" style="flex: 1; position: relative; margin-top: 10px">
      <template v-if="activeTask !== undefined">
        <!-- <n-virtual-list
          item-resizable
          :item-size="100"
          :items="taskList.info[activeTask as number].nexts"
          :style="sizeStyle"
        >
          <template #default="{ item, index }">
            <div :key="index">
              <status-row :item="item"></status-row>
            </div>
          </template>
        </n-virtual-list> -->
        <dynamic-scroller
          :items="taskList.info[activeTask as number].nexts"
          :min-item-size="120"
          :style="sizeStyle"
        >
          <template #default="{ item, index, active }">
            <dynamic-scroller-item
              :item="item"
              :active="active"
              :size-dependencies="[item.recos.length, !!item.act]"
              :data-index="index"
            >
              <div style="padding-bottom: 10px">
                <status-row :item="item"></status-row>
              </div>
            </dynamic-scroller-item>
          </template>
        </dynamic-scroller>
      </template>
    </div>
  </n-card>
</template>
