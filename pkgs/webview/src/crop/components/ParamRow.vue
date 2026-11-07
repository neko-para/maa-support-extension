<script setup lang="ts">
import { computed } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'

/**
 * 参数行：左侧是人话标签 + pipeline 字段名（熟练用户可以直接对照 JSON），右侧是控件。
 * 用 display: contents 把两个单元格交给外层 .param-grid，保证多行标签对齐。
 */
const props = defineProps<{
  label: string
  field?: string
  tooltip?: string
}>()

const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '')

// 英文界面里标签与字段名往往相同，重复时只显示一次
const showField = computed(() => !!props.field && normalize(props.field) !== normalize(props.label))
</script>

<template>
  <div class="param-row">
    <Tooltip trigger="hover" placement="left" :disabled="!props.tooltip || undefined">
      <template #trigger>
        <span class="param-label" :class="{ 'has-tip': !!props.tooltip }">
          {{ props.label }}
          <code v-if="showField" class="param-field">{{ props.field }}</code>
        </span>
      </template>
      {{ props.tooltip }}
    </Tooltip>
    <div class="param-control">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.param-row {
  display: contents;
}

.param-label {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  color: var(--vscode-foreground, inherit);
}

.param-label.has-tip {
  cursor: help;
}

.param-field {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  color: var(--vscode-descriptionForeground, gray);
}

.param-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
</style>
