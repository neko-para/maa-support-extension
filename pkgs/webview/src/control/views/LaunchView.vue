<script setup lang="ts">
import { NButton, NCard } from 'naive-ui'

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
    <n-button :disabled="!canLaunch" @click="launch" size="small">
      {{ t('maa.control.launch.start') }}
    </n-button>
  </n-card>
</template>
