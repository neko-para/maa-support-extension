<script setup lang="ts">
import { default as CheckOutlined } from '@vicons/material/es/CheckOutlined'
import { default as ContentCopyOutlined } from '@vicons/material/es/ContentCopyOutlined'
import { NButton, NIcon } from 'naive-ui'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import { useCopy } from '../utils/copy'

/** 「标签 + 等宽值」的可复制小块：点击复制，图标短暂变成对勾 */
const props = defineProps<{
  label?: string
  value: string
  /** 实际写入剪贴板的文本，缺省为 value */
  text?: string
  tooltip?: string
  disabled?: boolean
}>()

const { copied, copy } = useCopy()
</script>

<template>
  <Tooltip trigger="hover" :disabled="!props.tooltip || undefined">
    <template #trigger>
      <n-button
        size="small"
        class="copy-chip"
        :disabled="props.disabled"
        @click="copy(props.text ?? props.value)"
      >
        <span v-if="props.label" class="copy-chip-label">{{ props.label }}</span>
        <span class="copy-chip-value">{{ props.value }}</span>
        <n-icon class="copy-chip-icon" :class="{ done: copied }" size="14">
          <check-outlined v-if="copied"></check-outlined>
          <content-copy-outlined v-else></content-copy-outlined>
        </n-icon>
      </n-button>
    </template>
    {{ props.tooltip }}
    <template v-if="copied"> · {{ t('maa.crop.copied') }}</template>
  </Tooltip>
</template>

<style scoped>
.copy-chip :deep(.n-button__content) {
  gap: 6px;
}

.copy-chip-label {
  color: var(--vscode-descriptionForeground, gray);
}

.copy-chip-value {
  font-family: var(--vscode-editor-font-family, monospace);
}

.copy-chip-icon {
  opacity: 0.55;
}

.copy-chip-icon.done {
  opacity: 1;
  color: var(--vscode-testing-iconPassed, #73c991);
}
</style>
