<script setup lang="ts">
import { NButton } from 'naive-ui'

import { send } from '../ipc'
import StateLabel from './StateLabel.vue'

defineProps<{
  id: number
  status: 'running' | 'success' | 'failed' | null
}>()

function requestReco(id?: number) {
  if (typeof id !== 'number') {
    return
  }
  send({
    cmd: 'launch.reco',
    reco: id
  })
}
</script>

<template>
  <n-button @click="requestReco(id)">
    <state-label :status="status">
      <slot></slot>
    </state-label>
  </n-button>
</template>
