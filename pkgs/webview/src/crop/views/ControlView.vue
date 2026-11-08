<script setup lang="ts">
import { default as ContentPasteOutlined } from '@vicons/material/es/ContentPasteOutlined'
import { default as FileUploadOutlined } from '@vicons/material/es/FileUploadOutlined'
import { default as HelpOutlineOutlined } from '@vicons/material/es/HelpOutlineOutlined'
import { default as MoreHorizOutlined } from '@vicons/material/es/MoreHorizOutlined'
import { default as PhotoCameraOutlined } from '@vicons/material/es/PhotoCameraOutlined'
import { default as SaveOutlined } from '@vicons/material/es/SaveOutlined'
import { type DropdownOption, NButton, NDropdown, NFlex, NIcon, NPopover } from 'naive-ui'
import { computed } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import CopyChip from '../components/CopyChip.vue'
import * as canvasSt from '../states/canvas'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { revealExport } from '../states/visible'

const hasImage = computed(() => !!imageSt.data.value)
const hasRoi = computed(() => {
  const size = controlSt.cropBox.value.size
  return Math.abs(size.w) > 0 && Math.abs(size.h) > 0
})

// 低频动作收进「更多」：新手不被一排同权重按钮淹没，熟练用户两步也能到达
const moreOptions = computed<DropdownOption[]>(() => [
  { key: 'copy-field', label: t('maa.crop.more.copy-field') },
  {
    key: 'copy-roi-ex',
    label: t('maa.crop.more.copy-roi-ex', controlSt.roiExpandDisp())
  },
  { type: 'divider', key: 'd2' },
  {
    key: 'resize',
    label: t('maa.crop.more.resize'),
    disabled: !hasImage.value || imageSt.resizing.value
  },
  { key: 'fit-viewport', label: t('maa.crop.more.fit-viewport') },
  { key: 'actual-size', label: t('maa.crop.more.actual-size') }
])

function onMore(key: string) {
  switch (key) {
    case 'copy-field':
      controlSt.copyRoiField()
      break
    case 'copy-roi-ex':
      controlSt.copyRoiExpand()
      break
    case 'resize':
      void imageSt.resize()
      break
    case 'fit-viewport':
      canvasSt.fitViewport()
      break
    case 'actual-size':
      canvasSt.actualSizeViewport()
      break
  }
}

const shortcuts = computed(() => [
  ['Ctrl + ' + t('maa.crop.help.drag'), t('maa.crop.help.new-roi')],
  [t('maa.crop.help.drag-roi'), t('maa.crop.help.move-roi')],
  [t('maa.crop.help.wheel'), t('maa.crop.help.zoom')],
  [t('maa.crop.help.middle-drag'), t('maa.crop.help.pan')],
  ['Esc', t('maa.crop.help.esc')],
  ['Ctrl + Enter', t('maa.crop.help.run-test')]
])
</script>

<template>
  <n-flex align="center" :size="[8, 6]" class="toolbar">
    <!-- 图像来源与保存 -->
    <n-flex align="center" :size="6" :wrap="false">
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            :type="hasImage ? 'default' : 'primary'"
            :loading="imageSt.screencapLoading.value"
            @click="imageSt.screencap()"
            size="small"
          >
            <template #icon>
              <n-icon><photo-camera-outlined></photo-camera-outlined></n-icon>
            </template>
            {{ t('maa.crop.screencap') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.screencap') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button :loading="imageSt.uploadLoading.value" @click="imageSt.upload()" size="small">
            <template #icon>
              <n-icon><file-upload-outlined></file-upload-outlined></n-icon>
            </template>
            {{ t('maa.crop.upload') }}
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.upload') }}
      </Tooltip>
      <Tooltip trigger="hover">
        <template #trigger>
          <span style="display: inline-flex">
            <n-button :disabled="!hasImage" @click="revealExport()" size="small">
              <template #icon>
                <n-icon><save-outlined></save-outlined></n-icon>
              </template>
              {{ t('maa.crop.download') }}
            </n-button>
          </span>
        </template>
        {{ t('maa.crop.tooltip.download') }}
      </Tooltip>
    </n-flex>

    <div class="toolbar-sep"></div>

    <!-- ROI：点数值即复制 -->
    <n-flex align="center" :size="4" :wrap="false">
      <copy-chip
        label="ROI"
        :value="hasRoi ? controlSt.roiDisp() : t('maa.crop.roi-empty')"
        :text="controlSt.roiText()"
        :disabled="!hasRoi"
        :tooltip="hasRoi ? t('maa.crop.tooltip.roi') : t('maa.crop.tooltip.roi-empty')"
      ></copy-chip>
      <Tooltip trigger="hover">
        <template #trigger>
          <n-button
            size="small"
            quaternary
            :aria-label="t('maa.crop.paste')"
            @click="controlSt.pasteRoi()"
          >
            <template #icon>
              <n-icon><content-paste-outlined></content-paste-outlined></n-icon>
            </template>
          </n-button>
        </template>
        {{ t('maa.crop.tooltip.paste-roi') }}
      </Tooltip>
      <n-dropdown trigger="click" :options="moreOptions" size="small" @select="onMore">
        <n-button
          size="small"
          quaternary
          :aria-label="t('maa.crop.more')"
          :loading="imageSt.resizing.value"
        >
          <template #icon>
            <n-icon><more-horiz-outlined></more-horiz-outlined></n-icon>
          </template>
        </n-button>
      </n-dropdown>
    </n-flex>

    <div style="flex: 1"></div>

    <!-- 右栏切换移进右栏壳（标签页 + 折叠竖条）；这里只留帮助 -->
    <n-flex align="center" :size="6" :wrap="false">
      <n-popover trigger="click" placement="bottom-end">
        <template #trigger>
          <n-button size="small" quaternary :aria-label="t('maa.crop.help.title')">
            <template #icon>
              <n-icon><help-outline-outlined></help-outline-outlined></n-icon>
            </template>
          </n-button>
        </template>
        <div class="help">
          <div class="help-title">{{ t('maa.crop.help.title') }}</div>
          <div class="help-grid">
            <template v-for="[key, desc] in shortcuts" :key="key">
              <kbd class="kbd">{{ key }}</kbd>
              <span>{{ desc }}</span>
            </template>
          </div>
          <div class="help-flow">{{ t('maa.crop.help.flow') }}</div>
        </div>
      </n-popover>
    </n-flex>
  </n-flex>
</template>

<style scoped>
.toolbar {
  width: 100%;
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
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
}

.help-flow {
  white-space: pre-line;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vscode-descriptionForeground, gray);
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
