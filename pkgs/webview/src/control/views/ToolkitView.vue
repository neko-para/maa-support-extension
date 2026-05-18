<script setup lang="ts">
import { NButton, NCard, NFlex, NText } from 'naive-ui'
import { ref } from 'vue'

import type { ToolkitJumpTarget } from '@mse/types'

import Tooltip from '../../components/Tooltip.vue'
import { t } from '../../utils/locale'
import { ipc } from '../ipc'
import { hostState } from '../state'

const loading = ref<string | null>(null)

const jumpTargets: {
  label: () => string
  target: ToolkitJumpTarget
  tooltip: () => string
}[] = [
  {
    label: () => t('maa.control.toolkit.open-maa-log'),
    target: 'maa-log',
    tooltip: () => t('maa.control.tooltip.open-maa-log')
  },
  {
    label: () => t('maa.control.toolkit.open-ext-log'),
    target: 'ext-log',
    tooltip: () => t('maa.control.tooltip.open-ext-log')
  },
  {
    label: () => t('maa.control.toolkit.open-crop-tool'),
    target: 'crop-tool',
    tooltip: () => t('maa.control.tooltip.open-crop-tool')
  },
  {
    label: () => t('maa.control.toolkit.switch-maa-version'),
    target: 'switch-maa-ver',
    tooltip: () => t('maa.control.tooltip.switch-maa-version')
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
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button
                :disabled="!!loading"
                :loading="loading === info.target"
                @click="jump(info.target)"
                size="small"
              >
                {{ info.label() }}
              </n-button>
            </template>
            {{ info.tooltip() }}
          </Tooltip>
        </template>
        <Tooltip v-if="hostState.admin !== undefined" trigger="hover">
          <template #trigger>
            <n-button
              :disabled="!!loading"
              :loading="loading === 'switch-admin'"
              @click="jump('switch-admin')"
              size="small"
              :type="hostState.admin ? 'warning' : 'default'"
              :ghost="hostState.admin"
            >
              {{ t('maa.control.toolkit.toggle-admin-mode') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.toggle-admin') }}
        </Tooltip>
        <Tooltip v-if="hostState.debugMode !== undefined" trigger="hover">
          <template #trigger>
            <n-button
              :disabled="!!loading"
              :loading="loading === 'switch-debug-mode'"
              @click="jump('switch-debug-mode')"
              size="small"
              :type="hostState.debugMode ? 'warning' : 'default'"
              :ghost="hostState.debugMode"
            >
              {{ t('maa.control.toolkit.toggle-debug-mode') }}
            </n-button>
          </template>
          {{ t('maa.control.tooltip.toggle-debug') }}
        </Tooltip>
      </n-flex>
      <n-text v-for="(info, idx) in hostState.fwStatus ?? []" :key="idx">
        {{ info }}
      </n-text>
    </n-flex>
  </n-card>
</template>
