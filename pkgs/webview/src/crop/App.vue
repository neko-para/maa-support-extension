<script setup lang="ts">
import { default as BrushOutlined } from '@vicons/material/es/BrushOutlined'
import { default as CloseOutlined } from '@vicons/material/es/CloseOutlined'
import { default as ColorizeOutlined } from '@vicons/material/es/ColorizeOutlined'
import { default as DockOutlined } from '@vicons/material/es/DockOutlined'
import { default as FileUploadOutlined } from '@vicons/material/es/FileUploadOutlined'
import { default as HandymanOutlined } from '@vicons/material/es/HandymanOutlined'
import { default as ImageSearchOutlined } from '@vicons/material/es/ImageSearchOutlined'
import { default as KeyboardArrowLeftOutlined } from '@vicons/material/es/KeyboardArrowLeftOutlined'
import { default as KeyboardArrowRightOutlined } from '@vicons/material/es/KeyboardArrowRightOutlined'
import { default as PhotoCameraOutlined } from '@vicons/material/es/PhotoCameraOutlined'
import { default as PictureInPictureAltOutlined } from '@vicons/material/es/PictureInPictureAltOutlined'
import { default as SaveOutlined } from '@vicons/material/es/SaveOutlined'
import { default as SettingsOutlined } from '@vicons/material/es/SettingsOutlined'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import { NAlert, NButton, NConfigProvider, NFlex, NIcon, NScrollbar } from 'naive-ui'
import { type Component, computed, onUnmounted, ref } from 'vue'

import Tooltip from '../components/AppTooltip.vue'
import { t } from '../utils/locale'
import { useTheme } from '../utils/theme'
import HistoryStrip from './components/HistoryStrip.vue'
import ModeBar from './components/ModeBar.vue'
import ToolRail from './components/ToolRail.vue'
import * as canvasSt from './states/canvas'
import * as controlSt from './states/control'
import * as drawResultSt from './states/drawResult'
import * as imageSt from './states/image'
import * as modeSt from './states/mode'
import {
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  floatRect,
  panelFloat,
  panelWidth,
  sidePanel
} from './states/visible'
import CalcPanel from './views/CalcPanel.vue'
import ColorPanel from './views/ColorPanel.vue'
import ControlView from './views/ControlView.vue'
import ExportPanel from './views/ExportPanel.vue'
import MaskPanel from './views/MaskPanel.vue'
import SettingsView from './views/SettingsView.vue'
import TestPanel from './views/TestPanel.vue'

const { loaded, theme, themeOverride } = useTheme('panel')

hljs.registerLanguage('json', json)

const canvasSizeEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

canvasSt.setup(canvasSizeEl, canvasEl)
// 结果框绘制常驻：收起识别测试区块或切面板不丢画布上的结果
canvasSt.addDrawStep(drawResultSt.drawStep)

window.addEventListener('keydown', controlSt.onKeyDown)
window.addEventListener('keyup', controlSt.onKeyUp)
onUnmounted(() => {
  window.removeEventListener('keydown', controlSt.onKeyDown)
  window.removeEventListener('keyup', controlSt.onKeyUp)
})

// 有激活模式时隐藏缩略图条（模式名称与操作交给底部模式条）；roi 仍是 ROI 语境，不隐藏
const activeMode = computed(() => modeSt.mode.value !== 'pointer' && modeSt.mode.value !== 'roi')

const hasImage = computed(() => !!imageSt.data.value)

/** 拖入图片：空态和已有图都能替换，失败提示走 screencapError 通道 */
function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) {
    return
  }
  const reader = new FileReader()
  reader.onload = async () => {
    if (typeof reader.result === 'string' && !(await imageSt.set(reader.result))) {
      imageSt.screencapError.value = t('maa.crop.failure.decode')
    }
  }
  reader.readAsDataURL(file)
}

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

// ---------- 右栏：拖拽宽度 + 折叠竖条 ----------

function collapsePanel() {
  sidePanel.value = 'hidden'
}

type PanelTarget = 'test' | 'color' | 'mask' | 'calc' | 'export' | 'settings'

/** dock 与浮窗共用同一套标签：图标只在 rail/浮窗里用 */
const panelTabs: { key: PanelTarget; label: Parameters<typeof t>[0]; icon: Component }[] = [
  { key: 'test', label: 'maa.crop.test.title', icon: ImageSearchOutlined },
  { key: 'color', label: 'maa.crop.color', icon: ColorizeOutlined },
  { key: 'mask', label: 'maa.crop.tools.green-mask', icon: BrushOutlined },
  { key: 'calc', label: 'maa.crop.tools.roi-offset', icon: HandymanOutlined },
  { key: 'export', label: 'maa.crop.export', icon: SaveOutlined },
  { key: 'settings', label: 'maa.crop.settings', icon: SettingsOutlined }
]

function openPanel(target: PanelTarget) {
  sidePanel.value = target
}

function toggleRail(target: PanelTarget) {
  // 竖条里同一个图标再点一次 = 收起；不同图标 = 切换面板
  sidePanel.value = sidePanel.value === target ? 'hidden' : target
}

/** 拖拽分隔条：直接改像素宽度，clamp 到 300–560 */
let dragStartX = 0
let dragStartW = 0
function startPanelDrag(event: PointerEvent) {
  dragStartX = event.clientX
  dragStartW = panelWidth.value
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)
  const move = (e: PointerEvent) => {
    const w = dragStartW + (dragStartX - e.clientX)
    panelWidth.value = Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(w)))
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

// ---------- 悬浮窗：拖动标题栏移动，右下角拖尺寸；h 未拖过则自适应内容 ----------

const FLOAT_W_MIN = 260
const FLOAT_W_MAX = 640

/** 悬浮窗样式：位置/宽度持久化；高度仅在用户拖过角柄后固定 */
const floatStyle = computed(() => {
  const r = floatRect.value
  const s: Record<string, string> = { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px` }
  if (r.h) {
    s.height = `${r.h}px`
  }
  return s
})

function clampFloatRect(r: { x: number; y: number; w: number; h?: number }) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  r.w = Math.min(FLOAT_W_MAX, Math.max(FLOAT_W_MIN, Math.round(r.w)))
  // 至少留在视口内一条边（标题栏永远可抓）
  r.x = Math.min(Math.max(r.x, 40 - r.w), vw - 40)
  r.y = Math.min(Math.max(r.y, 0), vh - 40)
  if (r.h) {
    r.h = Math.min(Math.max(r.h, 160), vh - 16)
  }
}

function startFloatDrag(event: PointerEvent) {
  const start = { ...floatRect.value }
  const sx = event.clientX
  const sy = event.clientY
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)
  const move = (e: PointerEvent) => {
    const r = { ...start, x: start.x + e.clientX - sx, y: start.y + e.clientY - sy }
    clampFloatRect(r)
    floatRect.value = r
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

function startFloatResize(event: PointerEvent) {
  event.stopPropagation()
  const start = { ...floatRect.value }
  const sx = event.clientX
  const sy = event.clientY
  const el = event.currentTarget as HTMLElement
  el.setPointerCapture(event.pointerId)
  const move = (e: PointerEvent) => {
    const r = {
      ...start,
      w: start.w + e.clientX - sx,
      // 用户拖过角柄就记住高度；想回自适应双击角柄
      h: (start.h ?? document.getElementById('crop-float')?.offsetHeight ?? 300) + e.clientY - sy
    }
    clampFloatRect(r)
    floatRect.value = r
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

function resetFloatHeight() {
  // 双击角柄：回内容自适应高度
  floatRect.value = { ...floatRect.value, h: undefined }
}
</script>

<template>
  <template v-if="loaded">
    <n-config-provider :theme="theme" :theme-overrides="themeOverride" :hljs="hljs">
      <div class="crop-root">
        <div class="crop-header">
          <control-view></control-view>
        </div>

        <div v-if="notices.length" class="crop-notices">
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
        </div>

        <div class="crop-body">
          <!-- 左侧工具轨：模式单选 + 帮助（?） -->
          <tool-rail></tool-rail>

          <div class="crop-stage">
            <div
              ref="canvasSizeEl"
              class="crop-canvas-box"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
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
                <div class="crop-empty-steps">
                  <div>{{ t('maa.crop.overlay.empty-steps') }}</div>
                  <div>{{ t('maa.crop.overlay.empty-drop') }}</div>
                </div>
              </div>

              <history-strip v-show="!activeMode"></history-strip>
            </div>

            <!-- 模式条：随模式切换，pointer 下给 ROI 四数字编辑，其他模式给上下文操作 -->
            <mode-bar></mode-bar>

            <div class="crop-status">
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

          <!-- 拖拽分隔条：300–560px；双击回默认宽 -->
          <div
            v-if="sidePanel !== 'hidden' && !panelFloat"
            class="crop-side-resizer"
            title=""
            @pointerdown="startPanelDrag"
            @dblclick="panelWidth = 360"
          ></div>

          <div
            v-if="sidePanel !== 'hidden' && !panelFloat"
            class="crop-side"
            :style="{ width: `${panelWidth}px` }"
          >
            <div class="crop-side-tabs">
              <button
                v-for="tab in panelTabs"
                :key="tab.key"
                class="crop-side-tab"
                :class="{ 'is-active': sidePanel === tab.key }"
                @click="openPanel(tab.key)"
              >
                {{ t(tab.label) }}
              </button>
              <div style="flex: 1"></div>
              <Tooltip trigger="hover">
                <template #trigger>
                  <button class="crop-side-tab crop-side-collapse" @click="panelFloat = true">
                    <n-icon
                      ><picture-in-picture-alt-outlined></picture-in-picture-alt-outlined
                    ></n-icon>
                  </button>
                </template>
                {{ t('maa.crop.side.float') }}
              </Tooltip>
              <Tooltip trigger="hover">
                <template #trigger>
                  <button class="crop-side-tab crop-side-collapse" @click="collapsePanel()">
                    <n-icon><keyboard-arrow-right-outlined></keyboard-arrow-right-outlined></n-icon>
                  </button>
                </template>
                {{ t('maa.crop.side.collapse') }}
              </Tooltip>
            </div>
            <n-scrollbar class="crop-side-scroll">
              <test-panel v-show="sidePanel === 'test'"></test-panel>
              <color-panel v-show="sidePanel === 'color'"></color-panel>
              <mask-panel v-show="sidePanel === 'mask'"></mask-panel>
              <calc-panel v-show="sidePanel === 'calc'"></calc-panel>
              <export-panel v-show="sidePanel === 'export'"></export-panel>
              <settings-view v-show="sidePanel === 'settings'"></settings-view>
            </n-scrollbar>
          </div>

          <!-- 悬浮窗：图标标签 + 拖标题栏移动；高度自适应内容（拖角柄后固定，双击角柄回自适应） -->
          <div
            v-if="sidePanel !== 'hidden' && panelFloat"
            id="crop-float"
            class="crop-float"
            :style="floatStyle"
          >
            <div class="crop-float-tabs" @pointerdown="startFloatDrag">
              <Tooltip v-for="tab in panelTabs" :key="tab.key" trigger="hover">
                <template #trigger>
                  <button
                    class="crop-float-tab"
                    :class="{ 'is-active': sidePanel === tab.key }"
                    @pointerdown.stop
                    @click="openPanel(tab.key)"
                  >
                    <n-icon><component :is="tab.icon"></component></n-icon>
                  </button>
                </template>
                {{ t(tab.label) }}
              </Tooltip>
              <div style="flex: 1"></div>
              <Tooltip trigger="hover">
                <template #trigger>
                  <button class="crop-float-tab" @pointerdown.stop @click="panelFloat = false">
                    <n-icon><dock-outlined></dock-outlined></n-icon>
                  </button>
                </template>
                {{ t('maa.crop.side.dock') }}
              </Tooltip>
              <Tooltip trigger="hover">
                <template #trigger>
                  <button class="crop-float-tab" @pointerdown.stop @click="collapsePanel()">
                    <n-icon><close-outlined></close-outlined></n-icon>
                  </button>
                </template>
                {{ t('maa.crop.side.collapse') }}
              </Tooltip>
            </div>
            <n-scrollbar
              class="crop-float-scroll"
              :style="{ maxHeight: floatRect.h ? `${floatRect.h - 40}px` : '70vh' }"
            >
              <test-panel v-show="sidePanel === 'test'"></test-panel>
              <color-panel v-show="sidePanel === 'color'"></color-panel>
              <mask-panel v-show="sidePanel === 'mask'"></mask-panel>
              <calc-panel v-show="sidePanel === 'calc'"></calc-panel>
              <export-panel v-show="sidePanel === 'export'"></export-panel>
              <settings-view v-show="sidePanel === 'settings'"></settings-view>
            </n-scrollbar>
            <div
              class="crop-float-resize"
              title=""
              @pointerdown="startFloatResize"
              @dblclick="resetFloatHeight"
            ></div>
          </div>

          <!-- 折叠竖条：图标即面板入口，再点当前图标收起 -->
          <div v-if="sidePanel === 'hidden'" class="crop-side-rail">
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('test')">
                  <n-icon><image-search-outlined></image-search-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.test.title') }}
            </Tooltip>
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('color')">
                  <n-icon><colorize-outlined></colorize-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.color') }}
            </Tooltip>
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('mask')">
                  <n-icon><brush-outlined></brush-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.tools.green-mask') }}
            </Tooltip>
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('calc')">
                  <n-icon><handyman-outlined></handyman-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.tools.roi-offset') }}
            </Tooltip>
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('export')">
                  <n-icon><save-outlined></save-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.export') }}
            </Tooltip>
            <Tooltip trigger="hover" placement="left">
              <template #trigger>
                <button class="crop-side-rail-btn" @click="toggleRail('settings')">
                  <n-icon><settings-outlined></settings-outlined></n-icon>
                </button>
              </template>
              {{ t('maa.crop.settings') }}
            </Tooltip>
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
  position: relative;
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

.crop-side-resizer {
  flex: 0 0 6px;
  margin: 0 -3px;
  cursor: col-resize;
  border-radius: 3px;
}

.crop-side-resizer:hover {
  background: var(--vscode-focusBorder, #007fd4);
  opacity: 0.4;
}

.crop-side {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  /* 拖拽给出的值已经夹在 300–560，这里再给窄屏一道保险 */
  max-width: 70vw;
  min-height: 0;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.crop-side-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 4px 0 4px;
  border-bottom: 1px solid
    var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.crop-side-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--vscode-foreground, inherit);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.crop-side-tab:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.crop-side-tab.is-active {
  color: var(--vscode-textLink-foreground, #3794ff);
  border-bottom-color: var(--vscode-textLink-foreground, #3794ff);
  font-weight: 600;
}

.crop-side-collapse {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
}

.crop-side-scroll {
  flex: 1;
  min-height: 0;
}

.crop-side-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 32px;
  min-height: 0;
  padding-top: 4px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
}

.crop-side-rail-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--vscode-foreground, inherit);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.crop-side-rail-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

/* 悬浮窗：标题栏拖动移动，右下角拖尺寸，高度默认随内容 */
.crop-float {
  position: absolute;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--vscode-sideBar-background, var(--vscode-editor-background, #1f1f1f));
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.crop-float-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-bottom: 1px solid
    var(--vscode-editorWidget-border, var(--vscode-panel-border, transparent));
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.crop-float-tabs:active {
  cursor: grabbing;
}

.crop-float-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--vscode-foreground, inherit);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 15px;
}

.crop-float-tab:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.crop-float-tab.is-active {
  color: var(--vscode-textLink-foreground, #3794ff);
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.18));
}

.crop-float-scroll {
  min-height: 0;
}

.crop-float-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  touch-action: none;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--vscode-descriptionForeground, gray) 50%,
    var(--vscode-descriptionForeground, gray) 55%,
    transparent 55%,
    transparent 70%,
    var(--vscode-descriptionForeground, gray) 70%,
    var(--vscode-descriptionForeground, gray) 75%,
    transparent 75%
  );
  opacity: 0.5;
}

.crop-float-resize:hover {
  opacity: 1;
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

.crop-status-item code {
  font-family: var(--vscode-editor-font-family, monospace);
  color: var(--vscode-foreground, inherit);
}
</style>
