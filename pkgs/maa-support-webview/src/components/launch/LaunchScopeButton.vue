<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { NButton } from 'naive-ui'

import type { ActionScope, RecoScope } from '../../states/launch'

defineProps<{
  scope: RecoScope | ActionScope
}>()
</script>

<template>
  <n-button
    size="small"
    ghost
    :loading="scope.status === 'running'"
    :type="
      scope.status === 'success' ? 'success' : scope.status === 'failed' ? 'warning' : undefined
    "
  >
    <template #icon>
      <close-outlined v-if="scope.status === 'failed'"></close-outlined>
      <check-outlined v-else-if="scope.status === 'success'"></check-outlined>
    </template>
    {{ `${scope.type === 'reco' ? 'R' : 'A'} ${scope.msg.name}` }}
  </n-button>
</template>
