<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { canLaunch } from '../state'

function evalTask() {
  ipc.send({
    command: 'maa.evalTask'
  })
}
</script>

<template>
  <n-card :title="'计算工具'" size="small">
    <n-button @click="evalTask" size="small">
      {{ '计算任务' }}
    </n-button>
  </n-card>
</template>
