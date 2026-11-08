<script setup lang="ts">
import { default as KeyboardArrowDownOutlined } from '@vicons/material/es/KeyboardArrowDownOutlined'
import { type DropdownOption, NButton, NDropdown, NIcon } from 'naive-ui'
import { computed } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import { type PipelineVersion, pipelineVersion } from '../states/visible'

/** 「复制 pipeline 片段」的版本选择：v1 平铺 / v2 纵深，选择持久化到 CropSettings */

const options = computed<DropdownOption[]>(() => [
  { key: 'v2', label: t('maa.crop.snippet.v2') },
  { key: 'v1', label: t('maa.crop.snippet.v1') }
])

const current = computed(() => pipelineVersion.value)

function select(key: string) {
  pipelineVersion.value = key as PipelineVersion
}
</script>

<template>
  <Tooltip trigger="hover">
    <template #trigger>
      <n-dropdown trigger="click" :options="options" size="small" @select="select">
        <n-button size="small" quaternary class="snippet-version">
          {{ current === 'v2' ? t('maa.crop.snippet.v2') : t('maa.crop.snippet.v1') }}
          <n-icon><keyboard-arrow-down-outlined></keyboard-arrow-down-outlined></n-icon>
        </n-button>
      </n-dropdown>
    </template>
    {{ t('maa.crop.tooltip.snippet-version') }}
  </Tooltip>
</template>

<style scoped>
.snippet-version {
  font-family: var(--vscode-editor-font-family, monospace);
}
</style>
