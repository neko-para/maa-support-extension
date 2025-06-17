<script setup lang="ts">
import { NButton, NCard, NFlex, NTab, NTabs, NVirtualList } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { DynamicScroller, DynamicScrollerItem } from '../../utils/vvs'
import StatusRow from '../components/StatusRow.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import { activeTask, followLast, taskList } from '../states/task'

function requestStop() {
  ipc.send({
    command: 'requestStop'
  })
}

let resizeObs: ResizeObserver
const sizingEl = ref<HTMLDivElement | null>(null)
const size = ref<[number, number]>([0, 0])
const sizeStyle = computed(() => {
  return `position: absolute; left: 0; top: 0; width: ${size.value[0]}px; height: ${size.value[1]}px`
})

onMounted(() => {
  const resize = () => {
    const rec = sizingEl.value!.getBoundingClientRect()
    size.value = [rec.width, rec.height]
  }
  resizeObs = new ResizeObserver(resize)
  resizeObs.observe(sizingEl.value!)
  resize()
})

onUnmounted(() => {
  resizeObs.disconnect()
})
</script>

<template>
  <n-card
    title="流程"
    content-class="card-content"
    style="height: 100vh"
    content-style="display: flex; flex-direction: column"
  >
    <template #header-extra>
      <n-flex>
        <n-button @click="followLast = !followLast"> 跟随 </n-button>
        <n-button :disabled="hostState.stopped" @click="requestStop"> 停止 </n-button>
      </n-flex>
    </template>

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
