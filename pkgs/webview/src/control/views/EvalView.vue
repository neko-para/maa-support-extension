<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'

function evalTask() {
  ipc.send({
    command: 'maa.evalTask'
  })
}
</script>

<template>
  <n-card :title="t('maa.control.eval-tool')" size="small">
    <n-button @click="evalTask" size="small">
      {{ t('maa.control.eval-task') }}
    </n-button>
  </n-card>
</template>
