<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'

import { ipc } from '../ipc'
import { canLaunch } from '../state'

function launch() {
  ipc.send({
    command: 'launch'
  })
}
</script>

<template>
  <n-card title="执行" size="small">
    <n-button :disabled="!canLaunch" @click="launch" size="small"> 启动 </n-button>
  </n-card>
</template>
