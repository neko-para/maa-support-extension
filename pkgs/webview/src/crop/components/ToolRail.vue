<script setup lang="ts">
import { default as BrushOutlined } from '@vicons/material/es/BrushOutlined'
import { default as ColorizeOutlined } from '@vicons/material/es/ColorizeOutlined'
import { default as CropOutlined } from '@vicons/material/es/CropOutlined'
import { default as HelpOutlineOutlined } from '@vicons/material/es/HelpOutlineOutlined'
import { default as NearMeOutlined } from '@vicons/material/es/NearMeOutlined'
import { default as SelectAllOutlined } from '@vicons/material/es/SelectAllOutlined'
import { NIcon, NPopover } from 'naive-ui'
import { type Component, computed, markRaw } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import * as modeSt from '../states/mode'
import * as pickSt from '../states/pick'
import { helpShown } from '../states/visible'

/**
 * 左侧工具轨：模式单选（指针/点选/框选/涂绿）+ 底部帮助。
 * 每个按钮一个快捷键字母，标注在 tooltip 上；再点当前模式 = 退出回指针。
 */

const hasImage = computed(() => !!imageSt.data.value)

type RailKey = 'pointer' | 'roi' | 'pick-point' | 'pick-rect' | 'mask'
const railLabels: Record<RailKey, Parameters<typeof t>[0]> = {
  pointer: 'maa.crop.rail.pointer',
  roi: 'maa.crop.rail.roi',
  'pick-point': 'maa.crop.rail.pick-point',
  'pick-rect': 'maa.crop.rail.pick-rect',
  mask: 'maa.crop.rail.mask'
}

const tools = computed<{ key: RailKey; mode: modeSt.CropMode; icon: Component }[]>(() => [
  {
    key: 'pointer',
    mode: 'pointer',
    icon: markRaw(NearMeOutlined)
  },
  {
    key: 'roi',
    mode: 'roi',
    icon: markRaw(SelectAllOutlined)
  },
  {
    key: 'pick-point',
    mode: 'pick-point',
    icon: markRaw(ColorizeOutlined)
  },
  {
    key: 'pick-rect',
    mode: 'pick-rect',
    icon: markRaw(CropOutlined)
  },
  {
    key: 'mask',
    mode: 'mask',
    icon: markRaw(BrushOutlined)
  }
])

const kbdLabel: Record<RailKey, string> = {
  pointer: 'V',
  roi: 'R',
  'pick-point': 'P',
  'pick-rect': 'S',
  mask: 'M'
}

function toggle(m: modeSt.CropMode) {
  if (modeSt.mode.value === m) {
    modeSt.exitMode()
    return
  }
  switch (m) {
    case 'pick-point':
      pickSt.start()
      return
    case 'pick-rect':
      pickSt.startSelect()
      return
    case 'mask':
      greenMaskSt.start()
      return
    default:
      modeSt.setMode(m)
  }
}

const shortcuts = computed(() => [
  ['V / R / P / S / M', t('maa.crop.help.mode-keys')],
  [t('maa.crop.help.drag-roi'), t('maa.crop.help.move-roi')],
  ['Ctrl + ' + t('maa.crop.help.drag'), t('maa.crop.help.pan')],
  [t('maa.crop.help.wheel'), t('maa.crop.help.zoom')],
  [t('maa.crop.help.middle-drag'), t('maa.crop.help.pan')],
  ['[ / ]', t('maa.crop.help.brush-size')],
  ['Esc', t('maa.crop.help.esc')],
  ['Ctrl + Enter', t('maa.crop.help.run-test')],
  ['?', t('maa.crop.help.title')]
])
</script>

<template>
  <div
    class="tool-rail"
    role="toolbar"
    aria-orientation="vertical"
    :aria-label="t('maa.crop.rail.pointer')"
  >
    <Tooltip v-for="tool in tools" :key="tool.key" trigger="hover" placement="right">
      <template #trigger>
        <button
          class="rail-btn"
          :class="{ 'is-active': modeSt.mode.value === tool.mode }"
          :aria-pressed="modeSt.mode.value === tool.mode"
          :aria-label="`${t(railLabels[tool.key])} (${kbdLabel[tool.key]})`"
          :disabled="tool.mode !== 'pointer' && !hasImage"
          @click="toggle(tool.mode)"
        >
          <n-icon><component :is="tool.icon"></component></n-icon>
        </button>
      </template>
      {{ t(railLabels[tool.key]) }} · {{ kbdLabel[tool.key] }}
    </Tooltip>

    <div style="flex: 1"></div>

    <n-popover v-model:show="helpShown" trigger="manual" placement="right-start">
      <template #trigger>
        <Tooltip trigger="hover" placement="right">
          <template #trigger>
            <button
              class="rail-btn"
              :class="{ 'is-active': helpShown }"
              :aria-pressed="helpShown"
              :aria-label="`${t('maa.crop.help.title')} (?)`"
              @click="helpShown = !helpShown"
            >
              <n-icon><help-outline-outlined></help-outline-outlined></n-icon>
            </button>
          </template>
          {{ t('maa.crop.help.title') }} · ?
        </Tooltip>
      </template>
      <div class="help">
        <div class="help-title">{{ t('maa.crop.help.title') }}</div>
        <div class="help-grid">
          <template v-for="[key, desc] in shortcuts" :key="key">
            <kbd class="kbd">{{ key }}</kbd>
            <span>{{ desc }}</span>
          </template>
        </div>
      </div>
    </n-popover>
  </div>
</template>

<style scoped>
.tool-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 40px;
  min-height: 0;
  padding: 6px 0;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.rail-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--vscode-foreground, inherit);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 17px;
}

.rail-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.rail-btn.is-active {
  color: var(--vscode-textLink-foreground, #3794ff);
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.rail-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.help {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 360px;
}

.help-title {
  font-weight: 600;
}

.help-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 12px;
  align-items: center;
  font-size: 12px;
}

.kbd {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
}
</style>
