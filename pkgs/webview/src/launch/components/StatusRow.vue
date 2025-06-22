<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NButton, NCard, NFlex } from 'naive-ui'
import { ref } from 'vue'

import type { RecoInfo } from '@mse/types'

import { ipc } from '../ipc'
import { recoInfo, taskInfo } from '../states/info'
import type { NextListScope } from '../states/task'

const props = defineProps<{
  item: NextListScope
}>()

const querying = ref(false)

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

async function requestNode() {
  if (querying.value) {
    return
  }
  querying.value = true
  taskInfo.value = [
    props.item.info.name,
    (await ipc.call({
      command: 'requestNode',
      node: props.item.info.name
    })) as string | null
  ]
  querying.value = false
}
</script>

<template>
  <n-card size="small">
    <template #header>
      <n-button @click="requestNode" size="small">
        {{ item.info.name }}
      </n-button>
    </template>
    <n-flex>
      <template v-for="(reco, idx) in item.recos" :key="`reco-${idx}`">
        <n-button
          size="small"
          ghost
          :loading="reco.state === 'running'"
          :type="
            reco.state === 'success' ? 'success' : reco.state === 'failed' ? 'warning' : undefined
          "
          @click="requestReco(reco.info.reco_id)"
        >
          <template #icon>
            <close-outlined v-if="reco.state === 'failed'"></close-outlined>
            <check-outlined v-else-if="reco.state === 'success'"></check-outlined>
          </template>
          {{ reco.info.name }}
        </n-button>
      </template>
      <template v-for="(reco, idx) in item.info.list.slice(item.recos.length)" :key="`wait-${idx}`">
        <n-button size="small" ghost disabled>
          {{ reco }}
        </n-button>
      </template>
    </n-flex>

    <template #footer v-if="item.act">
      <n-button
        size="small"
        ghost
        :loading="item.act.state === 'running'"
        :type="
          item.act.state === 'success'
            ? 'success'
            : item.act.state === 'failed'
              ? 'error'
              : undefined
        "
      >
        <template #icon>
          <close-outlined v-if="item.act.state === 'failed'"></close-outlined>
          <check-outlined v-else-if="item.act.state === 'success'"></check-outlined>
        </template>
        {{ item.act.info.name }}
      </n-button>
    </template>
  </n-card>
</template>
