<script setup lang="ts">
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NCard, NConfigProvider, NFlex, NScrollbar } from 'naive-ui'
import { computed, onUnmounted, ref } from 'vue'

import { t } from '../utils/locale'
import { useTheme } from '../utils/theme'
import HistoryStrip from './components/HistoryStrip.vue'
import * as canvasSt from './states/canvas'
import * as controlSt from './states/control'
import * as greenMaskSt from './states/greenMask'
import * as imageSt from './states/image'
import * as pickSt from './states/pick'
import { showTab } from './states/visible'
import ControlView from './views/ControlView.vue'
import SettingsView from './views/SettingsView.vue'
import ToolView from './views/ToolView.vue'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const canvasSizeEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

canvasSt.setup(canvasSizeEl, canvasEl)

window.addEventListener('keydown', controlSt.onKeyDown)
onUnmounted(() => {
  window.removeEventListener('keydown', controlSt.onKeyDown)
})

const activeMode = computed(() => {
  if (greenMaskSt.drawing.value) {
    return t('maa.crop.overlay.mode-masking')
  }
  if (pickSt.selecting.value) {
    return t('maa.crop.overlay.mode-selecting')
  }
  if (pickSt.picking.value) {
    return t('maa.crop.overlay.mode-picking')
  }
  return null
})
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <n-card
        :title="t('maa.crop.crop-tool')"
        style="height: 100vh"
        content-style="display: flex; flex-direction: column; gap: 10px; min-height: 0"
        size="small"
      >
        <template #header-extra>
          <control-view></control-view>
        </template>

        <n-flex style="flex: 1; min-height: 0">
          <div ref="canvasSizeEl" style="position: relative; flex: 1">
            <canvas
              ref="canvasEl"
              :style="{
                position: 'absolute',
                left: 0,
                top: 0,
                outline:
                  '1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent))',
                outlineOffset: '-1px',
                cursor: controlSt.cursor.value
              }"
              @wheel.prevent="controlSt.onWheel"
              @pointerdown.prevent="controlSt.onPointerDown"
              @pointermove.prevent="controlSt.onPointerMove"
              @pointerup.prevent="controlSt.onPointerUp"
              @contextmenu.prevent="controlSt.onContextMenu"
            ></canvas>
            <div v-if="!imageSt.data.value" class="crop-overlay-center">
              {{ t('maa.crop.overlay.empty') }}
            </div>
            <div v-if="activeMode" class="crop-overlay-top crop-overlay-mode">
              {{ activeMode }}
            </div>
            <div v-else-if="imageSt.data.value" class="crop-overlay-bottom">
              {{ t('maa.crop.overlay.hint') }}
            </div>
            <history-strip v-show="!activeMode"></history-strip>
          </div>
          <n-scrollbar v-if="showTab" style="width: 40vw">
            <settings-view v-show="showTab === 'settings'"></settings-view>
            <tool-view v-show="showTab === 'tool'"></tool-view>
          </n-scrollbar>
        </n-flex>
      </n-card>
    </n-config-provider>
  </template>
</template>

<style scoped>
.crop-overlay-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: var(--vscode-descriptionForeground, gray);
  font-size: 14px;
}

.crop-overlay-top {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.crop-overlay-mode {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--vscode-editorWidget-foreground, inherit);
  background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.6));
  border: 1px solid var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.crop-overlay-bottom {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, gray);
  background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.4));
  border: 1px solid var(--vscode-editorWidget-border, transparent);
}
</style>
