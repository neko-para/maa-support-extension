<script setup lang="ts">
import type { LaunchViewState } from '@maaxyz/maa-support-types'
import { NButton, NCard, NFlex, NScrollbar, NTab, NTabs } from 'naive-ui'
import { type ShallowRef, inject, onMounted, ref, shallowRef } from 'vue'

import { type LaunchGraph, reduceLaunchGraph } from '../../states/launch'
import { request, useSubsribe } from '../../utils/api'
import { t } from '../../utils/locale'
import JsonCode from '../JsonCode.vue'
import LaunchTaskFragment from './LaunchTaskFragment.vue'

const launchState = inject<ShallowRef<LaunchViewState>>(
  'LaunchState',
  shallowRef<LaunchViewState>({ id: '' })
)

const launchGraph = shallowRef<LaunchGraph>({
  depth: 0,
  childs: []
})
const stopped = ref(false)
const activeTask = ref(0)

useSubsribe('launch/message', ({ id, msg }) => {
  if (id !== launchState.value.id) {
    return
  }
  msg.msg = msg.msg
    .replace(/^(Resource|Controller|Tasker|Node)\./, '')
    .replace('Task.Starting', 'Task.Started')
    .replace('Task.Succeeded', 'Task.Completed') as any
  // console.log('track', JSON.stringify(launchGraph.value), msg)
  // console.log('track msg', msg.msg)
  launchGraph.value = reduceLaunchGraph(launchGraph.value, msg)
  // console.log('track end', JSON.stringify(launchGraph.value))
})

onMounted(async () => {
  if (!launchState.value.runtime) {
    return
  }
  const succ = await request('/launch/create', {
    pageId: launchState.value.id,
    runtime: launchState.value.runtime
  })
  if (!succ?.succ) {
    console.log(succ?.error)
    return
  }
  await request('/launch/start', {
    pageId: launchState.value.id
  })
})

function requestStop() {
  stopped.value = true
  request('/launch/stop', {
    pageId: launchState.value.id
  })
}
</script>

<template>
  <n-card
    v-if="launchState.runtime"
    size="small"
    style="min-height: 0"
    content-style="display: flex; flex-direction: column; gap: 10px; min-height: 0"
  >
    <n-flex>
      <n-button :disabled="stopped" @click="requestStop">
        {{ t('maa.launch.stop') }}
      </n-button>
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

    <n-scrollbar style="min-height: 0">
      <template v-if="activeTask < launchGraph.childs.length">
        <launch-task-fragment
          style="min-height: 0"
          :item="launchGraph.childs[activeTask]"
        ></launch-task-fragment>
      </template>
    </n-scrollbar>
  </n-card>
</template>
