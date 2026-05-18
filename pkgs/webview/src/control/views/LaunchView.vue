<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'
import Tooltip from '../../components/Tooltip.vue'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { canLaunch } from '../state'

function launch() {
  ipc.send({
    command: 'launch'
  })
}
</script>

<template>
  <n-card :title="t('maa.control.launch.launch')" size="small">
    <Tooltip trigger="hover">
      <template #trigger>
        <n-button :disabled="!canLaunch" @click="launch" size="small">
          {{ t('maa.control.launch.start') }}
        </n-button>
      </template>
      {{ t('maa.control.tooltip.launch') }}
    </Tooltip>
  </n-card>
</template>
