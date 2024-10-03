<script setup lang="ts">
import { NButton } from 'naive-ui'

import StateLabel from './StateLabel.vue'

defineProps<{
  status: 'running' | 'success' | 'failed' | null
}>()
</script>

<template>
  <n-button>
    <state-label :status="status">
      <slot></slot>
    </state-label>
  </n-button>
</template>
