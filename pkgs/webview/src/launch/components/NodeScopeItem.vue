<script setup lang="ts">
import { NButton, NCard, NFlex } from 'naive-ui'
import { ref } from 'vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { taskInfo } from '../states/info'
import type { AnyNodeScope } from '../states/launch'
import NextListScopeItem from './NextListScopeItem.vue'
import RecoActionScopeItem from './RecoActionScopeItem.vue'

const props = defineProps<{
  item: AnyNodeScope
}>()

const querying = ref(false)

async function requestNode() {
  if (querying.value) {
    return
  }
  querying.value = true
  taskInfo.value = [
    props.item.msg.name,
    (await ipc.call({
      command: 'requestNode',
      node: props.item.msg.name
    })) as string | null
  ]
  querying.value = false
}

function gotoTask(task: string) {
  ipc.send({
    command: 'gotoTask',
    task
  })
}
</script>

<template>
  <n-card size="small">
    <template #header>
      <n-flex>
        <n-button @click="requestNode" :loading="querying" size="small">
          {{ item.msg.name }}
        </n-button>
        <template v-if="item.type === 'pipeline_node'">
          <n-button @click="gotoTask(item.msg.name)" size="small">
            {{ t('maa.launch.reveal') }}
          </n-button>
        </template>
      </n-flex>
    </template>

    <template #header-extra>
      <template v-if="item.type === 'pipeline_node'"> task </template>
      <template v-else-if="item.type === 'reco_node'"> reco </template>
      <template v-else-if="item.type === 'act_node'"> action </template>
    </template>

    <template v-if="item.type === 'pipeline_node'">
      <n-flex vertical>
        <template v-for="(reco, idx) in item.reco" :key="idx">
          <next-list-scope-item :item="reco"></next-list-scope-item>
        </template>
      </n-flex>
    </template>
    <template v-else-if="item.type === 'reco_node'">
      <template v-if="item.reco">
        <reco-action-scope-item :item="item.reco"></reco-action-scope-item>
      </template>
    </template>
    <template v-else-if="item.type === 'act_node'">
      <template v-if="item.action">
        <reco-action-scope-item :item="item.action"></reco-action-scope-item>
      </template>
    </template>

    <template #footer>
      <template v-if="item.type === 'pipeline_node'">
        <template v-if="item.action">
          <reco-action-scope-item :item="item.action"></reco-action-scope-item>
        </template>
      </template>
    </template>
  </n-card>
</template>
