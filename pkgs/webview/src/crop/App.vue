<script setup lang="ts">
import { default as FileUploadOutlined } from '@vicons/material/es/FileUploadOutlined'
import { default as PhotoCameraOutlined } from '@vicons/material/es/PhotoCameraOutlined'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NAlert, NButton, NConfigProvider, NFlex, NIcon, NScrollbar } from 'naive-ui'
import { computed, onUnmounted, ref } from 'vue'

import { t } from '../utils/locale'
import { useTheme } from '../utils/theme'
import HistoryStrip from './components/HistoryStrip.vue'
import * as canvasSt from './states/canvas'
import * as controlSt from './states/control'
import * as imageSt from './states/image'
import * as modeSt from './states/mode'
import { sidePanel } from './states/visible'
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
  switch (modeSt.mode.value) {
    case 'mask':
      return t('maa.crop.overlay.mode-masking')
    case 'lasso':
      return t('maa.crop.overlay.mode-lasso')
    case 'pick-rect':
      return t('maa.crop.overlay.mode-selecting')
    case 'pick-point':
      return t('maa.crop.overlay.mode-picking')
    default:
      return null
  }
})

const hasImage = computed(() => !!imageSt.data.value)

/** 状态栏：精确调 ROI 时需要的量化信息常驻可见 */
const pointerInside = ref(false)
const cursorText = computed(() => {
  if (!pointerInside.value) {
    return null
  }
  const pos = controlSt.viewport.value.fromView(controlSt.current.value).floor()
  const size = imageSt.size.value
  if (pos.x < 0 || pos.y < 0 || pos.x >= size.w || pos.y >= size.h) {
    return null
  }
  return `${pos.x}, ${pos.y}`
})
const roiSizeText = computed(() => {
  const roi = controlSt.requestRoi()
  return roi[2] > 0 && roi[3] > 0 ? `${roi[2]} × ${roi[3]}` : null
})
const zoomText = computed(() => `${Math.round(100 / controlSt.viewport.value.scale)}%`)

const notices = computed(() => {
  const list: { key: string; type: 'error'; text: string; close: () => void }[] = []
  if (imageSt.screencapError.value) {
    list.push({
      key: 'screencap',
      type: 'error',
      text: imageSt.screencapError.value,
      close: () => (imageSt.screencapError.value = null)
    })
  }
  if (imageSt.uploadError.value) {
    list.push({
      key: 'upload',
      type: 'error',
      text: imageSt.uploadError.value,
      close: () => (imageSt.uploadError.value = null)
    })
  }
  if (imageSt.saveError.value) {
    list.push({
      key: 'save',
      type: 'error',
      text: imageSt.saveError.value,
      close: () => (imageSt.saveError.value = null)
    })
  }
  return list
})
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <div class="crop-root">
        <div class="crop-header">
          <control-view></control-view>
        </div>

        <div
          v-if="notices.length || imageSt.saveInfo.value || imageSt.emptyRoiWarning.value"
          class="crop-notices"
        >
          <n-alert
            v-for="notice in notices"
            :key="notice.key"
            :type="notice.type"
            closable
            :show-icon="false"
            @close="notice.close"
          >
            {{ notice.text }}
          </n-alert>
          <n-alert
            v-if="imageSt.saveInfo.value"
            type="success"
            closable
            :show-icon="false"
            @close="imageSt.clearSaveInfo()"
          >
            <n-flex align="center" :size="8">
              <span>{{ imageSt.saveInfo.value }}</span>
              <n-button
                v-if="imageSt.savedRelativePath.value"
                size="tiny"
                type="primary"
                secondary
                @click="imageSt.copyTemplateSnippet()"
              >
                {{ t('maa.crop.save.copy-template') }}
              </n-button>
              <n-button size="tiny" @click="imageSt.revealSaved()">
                {{ t('maa.crop.save.open-folder') }}
              </n-button>
            </n-flex>
          </n-alert>
          <n-alert v-if="imageSt.emptyRoiWarning.value" type="warning" :show-icon="false">
            <n-flex align="center" :size="8">
              <span>{{ t('maa.crop.save.empty-roi') }}</span>
              <n-button size="tiny" @click="imageSt.download(true)">
                {{ t('maa.crop.save.save-whole') }}
              </n-button>
              <n-button size="tiny" quaternary @click="imageSt.cancelEmptyRoiWarning()">
                {{ t('maa.crop.save.cancel') }}
              </n-button>
            </n-flex>
          </n-alert>
        </div>

        <div class="crop-body">
          <div class="crop-stage">
            <div ref="canvasSizeEl" class="crop-canvas-box">
              <canvas
                ref="canvasEl"
                class="crop-canvas"
                :style="{ cursor: controlSt.cursor.value }"
                @wheel.prevent="controlSt.onWheel"
                @pointerdown.prevent="controlSt.onPointerDown"
                @pointermove.prevent="controlSt.onPointerMove"
                @pointerup.prevent="controlSt.onPointerUp"
                @contextmenu.prevent="controlSt.onContextMenu"
                @pointerenter="pointerInside = true"
                @pointerleave="pointerInside = false"
              ></canvas>

              <div v-if="!hasImage" class="crop-empty">
                <div class="crop-empty-title">{{ t('maa.crop.overlay.empty') }}</div>
                <n-flex justify="center" :size="10">
                  <n-button
                    type="primary"
                    :loading="imageSt.screencapLoading.value"
                    @click="imageSt.screencap()"
                  >
                    <template #icon>
                      <n-icon><photo-camera-outlined></photo-camera-outlined></n-icon>
                    </template>
                    {{ t('maa.crop.overlay.empty-screencap') }}
                  </n-button>
                  <n-button :loading="imageSt.uploadLoading.value" @click="imageSt.upload()">
                    <template #icon>
                      <n-icon><file-upload-outlined></file-upload-outlined></n-icon>
                    </template>
                    {{ t('maa.crop.overlay.empty-upload') }}
                  </n-button>
                </n-flex>
                <div class="crop-empty-steps">{{ t('maa.crop.overlay.empty-steps') }}</div>
              </div>

              <div v-if="activeMode" class="crop-mode-banner">
                <span>{{ activeMode }}</span>
                <n-button size="tiny" secondary @click="modeSt.exitMode()">
                  {{ t('maa.crop.overlay.mode-exit') }}
                </n-button>
              </div>

              <history-strip v-show="!activeMode"></history-strip>
            </div>

            <div class="crop-status">
              <span v-if="!hasImage"></span>
              <span v-else-if="activeMode" class="crop-status-hint">{{ activeMode }}</span>
              <span v-else class="crop-status-hint">{{ t('maa.crop.overlay.hint') }}</span>
              <div style="flex: 1"></div>
              <template v-if="hasImage">
                <span v-if="cursorText" class="crop-status-item">
                  {{ t('maa.crop.status.cursor') }} <code>{{ cursorText }}</code>
                </span>
                <span v-if="roiSizeText" class="crop-status-item">
                  ROI <code>{{ roiSizeText }}</code>
                </span>
                <span class="crop-status-item">
                  {{ t('maa.crop.status.image') }}
                  <code>{{ imageSt.size.value.w }} × {{ imageSt.size.value.h }}</code>
                </span>
                <span class="crop-status-item">
                  <code>{{ zoomText }}</code>
                </span>
              </template>
            </div>
          </div>

          <div v-if="sidePanel !== 'hidden'" class="crop-side">
            <n-scrollbar>
              <settings-view v-show="sidePanel === 'settings'"></settings-view>
              <tool-view v-show="sidePanel === 'tool'"></tool-view>
            </n-scrollbar>
          </div>
        </div>
      </div>
    </n-config-provider>
  </template>
</template>

<style scoped>
.crop-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 8px 10px;
  gap: 8px;
  box-sizing: border-box;
  color: var(--vscode-foreground, inherit);
}

.crop-notices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.crop-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 10px;
}

.crop-stage {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.crop-canvas-box {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.crop-canvas {
  position: absolute;
  left: 0;
  top: 0;
}

.crop-side {
  display: flex;
  flex-direction: column;
  width: clamp(340px, 34vw, 480px);
  min-height: 0;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.crop-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}

.crop-empty-title {
  font-size: 15px;
}

.crop-empty-steps {
  max-width: 420px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vscode-descriptionForeground, gray);
}

.crop-mode-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  white-space: nowrap;
  color: var(--vscode-editorWidget-foreground, inherit);
  background: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.6));
  border: 1px solid var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.crop-status {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 24px;
  padding: 0 10px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, gray);
  border-top: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
  white-space: nowrap;
  overflow: hidden;
}

.crop-status-hint {
  overflow: hidden;
  text-overflow: ellipsis;
}

.crop-status-item code {
  font-family: var(--vscode-editor-font-family, monospace);
  color: var(--vscode-foreground, inherit);
}
</style>
