<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NButton } from 'naive-ui'
import { ref } from 'vue'

import type { RecoInfo } from '@mse/types'

import { ipc } from '../ipc'
import { recoInfo } from '../states/info'
import type { ActionScope, RecoScope } from '../states/launch'

const props = defineProps<{
  item: RecoScope | ActionScope
  useWarning?: boolean
}>()

const querying = ref(false)

async function requestDetail() {
  if (props.item.type === 'reco') {
    requestReco(props.item.msg.reco_id)
  } else {
    // requestAct
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

function nodeId() {
  return props.item.type === 'reco' ? props.item.msg.reco_id : props.item.msg.action_id
}
</script>

<template>
  <n-button
    size="small"
    ghost
    :loading="item.status === 'running'"
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

    {{ item.msg.name }} {{ nodeId() }}
  </n-button>
</template>
