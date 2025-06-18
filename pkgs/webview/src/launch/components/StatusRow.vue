<script setup lang="ts">
import { CheckOutlined, CloseOutlined } from '@vicons/material'
import { NButton, NCard, NFlex } from 'naive-ui'
import { ref } from 'vue'

import type { RecoInfo } from '@mse/types'

import { ipc } from '../ipc'
import { recoInfo } from '../states/reco'
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
</script>

<template>
  <n-card :title="item.info.name" size="small">
    <n-flex>
      <template v-for="(reco, idx) in item.recos" :key="idx">
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
      <template v-for="(reco, idx) in item.info.list.slice(item.recos.length)" :key="idx">
        <n-button size="small" disabled>
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
