<script setup lang="ts">
import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import * as imageSt from '../states/image'
</script>

<template>
  <div v-if="imageSt.history.value.length > 1" class="crop-history-strip">
    <Tooltip trigger="hover">
      <template #trigger>
        <span class="crop-history-label">{{ t('maa.crop.history') }}</span>
      </template>
      {{ t('maa.crop.tooltip.history') }}
    </Tooltip>
    <img
      v-for="(entry, idx) in imageSt.history.value"
      :key="entry.id"
      :src="entry.thumb"
      :class="{ 'crop-history-thumb': true, current: idx === imageSt.historyCursor.value }"
      @click="imageSt.switchTo(idx)"
    />
  </div>
</template>

<style scoped>
.crop-history-strip {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.6));
  border: 1px solid var(--vscode-editorWidget-border, transparent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.crop-history-label {
  color: var(--vscode-descriptionForeground, gray);
  font-size: 12px;
  white-space: nowrap;
}

.crop-history-thumb {
  height: 32px;
  max-width: 48px;
  object-fit: contain;
  border: 1px solid var(--vscode-editorWidget-border, transparent);
  border-radius: 3px;
  cursor: pointer;
  background: var(--vscode-editorWidget-background, transparent);
}

.crop-history-thumb.current {
  border-color: var(--vscode-focusBorder, #007fd4);
}
</style>
