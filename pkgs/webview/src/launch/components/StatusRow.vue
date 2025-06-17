<script setup lang="ts">
import { CheckOutlined, CloseOutlined } from '@vicons/material'
import { NButton, NCard, NCode, NFlex, NText } from 'naive-ui'

import type { NextListScope } from '../states/task'

const props = defineProps<{
  item: NextListScope
}>()
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
