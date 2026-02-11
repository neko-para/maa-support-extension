<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NButton, NPopover } from 'naive-ui'
import { ref } from 'vue'

import type { ActionInfo, RecoInfo } from '@mse/types'

import { ipc } from '../ipc'
import { actInfo, recoInfo } from '../states/info'
import type { ActionScope, RecoScope } from '../states/launch'
import TaskDoc from './TaskDoc.vue'

const props = defineProps<{
  item: RecoScope | ActionScope
  useWarning?: boolean
}>()

const querying = ref(false)

async function requestDetail() {
  if (props.item.type === 'reco') {
    requestReco(props.item.msg.reco_id)
  } else {
    requestAct(props.item.msg.action_id)
  }
}

async function requestReco(reco_id: number) {
  if (querying.value) {
    return
  }
  querying.value = true
  recoInfo.value = (await ipc.call({
    command: 'requestReco',
    reco_id
  })) as RecoInfo | null
  querying.value = false
}

async function requestAct(action_id: number) {
  if (querying.value) {
    return
  }
  querying.value = true
  actInfo.value = (await ipc.call({
    command: 'requestAct',
    action_id
  })) as ActionInfo | null
  querying.value = false
}
</script>

<template>
  <n-popover trigger="hover">
    <template #trigger>
      <n-button
        size="small"
        ghost
        :loading="item.status === 'running' || querying"
        :type="
          item.status === 'success'
            ? 'success'
            : item.status === 'failed'
              ? useWarning
                ? 'warning'
                : 'error'
              : undefined
        "
        @click="requestDetail"
      >
        <template #icon>
          <close-outlined v-if="item.status === 'failed'"></close-outlined>
          <check-outlined v-else-if="item.status === 'success'"></check-outlined>
        </template>

        {{ item.msg.name }}
      </n-button>
    </template>

    <task-doc :text="item.msg.name"></task-doc>
  </n-popover>
</template>
