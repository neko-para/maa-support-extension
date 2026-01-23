<script setup lang="ts">
import { NButton, NCard, NFlex, NText } from 'naive-ui'
import { ref } from 'vue'

import type { ToolkitJumpTarget } from '@mse/types'

import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const loading = ref<string | null>(null)

const jumpTargets: {
  label: () => string
  target: ToolkitJumpTarget
}[] = [
  {
    label: () => t('maa.control.toolkit.open-maa-log'),
    target: 'maa-log'
  },
  {
    label: () => t('maa.control.toolkit.open-ext-log'),
    target: 'ext-log'
  },
  {
    label: () => t('maa.control.toolkit.open-crop-tool'),
    target: 'crop-tool'
  },
  {
    label: () => t('maa.control.toolkit.switch-maa-version'),
    target: 'switch-maa-ver'
  }
]

async function jump(target: ToolkitJumpTarget) {
  loading.value = target
  await ipc.call({
    command: 'toolkitJump',
    target
  })
  loading.value = null
}
</script>

<template>
  <n-card :title="t('maa.control.toolkit.toolkit')" size="small">
    <n-flex vertical>
      <n-flex wrap>
        <template v-for="info in jumpTargets" :key="info.target">
          <n-button
            :disabled="!!loading"
            :loading="loading === info.target"
            @click="jump(info.target)"
            size="small"
          >
            {{ info.label() }}
          </n-button>
        </template>
      </n-flex>
      <n-text v-for="(info, idx) in hostState.fwStatus ?? []" :key="idx">
        {{ info }}
      </n-text>
    </n-flex>
  </n-card>
</template>
