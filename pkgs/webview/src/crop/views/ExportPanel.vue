<script setup lang="ts">
import { NAlert, NButton, NFlex, NInput, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import ParamRow from '../components/ParamRow.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import SnippetVersion from '../components/SnippetVersion.vue'
import { ipc } from '../ipc'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import { setMode } from '../states/mode'
import * as settingsSt from '../states/settings'

/**
 * 导出面板：裁剪预览 + 命名 + 保存位置 + 选项。
 * 文件名带 {0} 占位时可写 ROI；宿主端负责最终落盘路径与非法字符过滤。
 */

const hasImage = computed(() => !!imageSt.data.value)
const hasRoi = computed(() => {
  const s = controlSt.cropBox.value.size
  return Math.abs(s.w) > 0 && Math.abs(s.h) > 0
})

// 预览随图像与 ROI 变化实时刷新（cropBox 是 ref，整个表达式都会反应）
const preview = computed(() => {
  // 读取依赖
  void controlSt.cropBox.value
  void imageSt.data.value
  return imageSt.croppedPreview()
})

function defaultName() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `crop_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const filename = ref('')
watch(hasImage, v => {
  if (v && !filename.value) {
    filename.value = defaultName()
  }
})
// 首次打开时已有图像也要给默认名
if (hasImage.value && !filename.value) {
  filename.value = defaultName()
}

async function pickSaveDir() {
  const dir = (await ipc.call({ command: 'requestPickFolder' })) as string | null
  if (dir) {
    settingsSt.saveDir.val = dir
  }
}

function saveWhole() {
  void imageSt.download(true, filename.value.trim() || undefined)
}
function save() {
  void imageSt.download(false, filename.value.trim() || undefined)
}
function pickRoi() {
  if (hasImage.value) {
    setMode('roi')
  }
}
</script>

<template>
  <n-flex vertical style="padding: 8px" :size="10">
    <!-- 裁剪预览 + 尺寸 -->
    <n-flex align="center" :size="10">
      <img v-if="preview" :src="preview.url" class="export-preview" :alt="t('maa.crop.download')" />
      <div v-else class="export-preview export-preview-empty">
        {{ t('maa.crop.roi-empty') }}
      </div>
      <n-flex vertical :size="2">
        <n-text v-if="preview">{{ preview.w }} × {{ preview.h }}</n-text>
        <n-text v-if="preview?.whole" depth="3" class="export-hint">
          {{ t('maa.crop.save.whole-image') }}
        </n-text>
        <n-text v-else-if="hasRoi" depth="3" class="export-hint">ROI</n-text>
      </n-flex>
    </n-flex>

    <!-- ROI 为空：明确提示 + 一键进框选模式 -->
    <n-alert v-if="hasImage && !hasRoi" type="warning" :show-icon="false">
      <n-flex align="center" :size="8">
        <span>{{ t('maa.crop.save.empty-roi') }}</span>
        <n-button size="tiny" @click="pickRoi()">{{ t('maa.crop.save.pick-roi-first') }}</n-button>
      </n-flex>
    </n-alert>

    <!-- 文件名 -->
    <param-row :label="t('maa.crop.save.filename')">
      <n-input
        v-model:value="filename"
        size="small"
        :placeholder="t('maa.crop.save.filename-default')"
        :disabled="!hasImage"
      />
    </param-row>

    <!-- 保存位置 -->
    <param-row :label="t('maa.crop.settings.save-dir')" :tooltip="t('maa.crop.tooltip.save-dir')">
      <n-flex align="center" :size="4" :wrap="false">
        <n-input
          readonly
          size="small"
          style="flex: 1"
          :value="settingsSt.saveDir.val ?? ''"
          :placeholder="t('maa.crop.settings.save-dir-default')"
        />
        <n-button size="small" @click="pickSaveDir()">
          {{ t('maa.crop.settings.save-dir-pick') }}
        </n-button>
        <n-button
          v-if="settingsSt.saveDir.val"
          size="small"
          quaternary
          @click="settingsSt.saveDir.val = undefined"
        >
          {{ t('maa.crop.settings.save-dir-clear') }}
        </n-button>
      </n-flex>
    </param-row>

    <!-- 选项 -->
    <settings-switch
      :inst="settingsSt.saveAddRoiInfo"
      :title="t('maa.crop.settings.saving-file-with-roi')"
      :on="t('maa.crop.settings.with-roi')"
      :off="t('maa.crop.settings.without-roi')"
    ></settings-switch>

    <!-- 保存动作 -->
    <n-flex :size="8" :wrap="false">
      <n-button
        type="primary"
        :loading="imageSt.downloadLoading.value"
        :disabled="!hasImage"
        @click="save()"
        style="flex: 1"
      >
        {{ t('maa.crop.download') }}
      </n-button>
      <n-button
        v-if="hasImage && !hasRoi"
        :loading="imageSt.downloadLoading.value"
        @click="saveWhole()"
      >
        {{ t('maa.crop.save.save-whole') }}
      </n-button>
    </n-flex>

    <!-- 保存结果：内联展示，不抢焦点 -->
    <n-alert
      v-if="imageSt.saveInfo.value"
      type="success"
      closable
      :show-icon="false"
      @close="imageSt.clearSaveInfo()"
    >
      <n-flex vertical :size="6">
        <span>{{ imageSt.saveInfo.value }}</span>
        <n-flex align="center" :size="6">
          <n-button
            v-if="imageSt.savedRelativePath.value"
            size="tiny"
            type="primary"
            secondary
            @click="imageSt.copyTemplateSnippet()"
          >
            {{ t('maa.crop.save.copy-template') }}
          </n-button>
          <snippet-version></snippet-version>
          <n-button size="tiny" @click="imageSt.revealSaved()">
            {{ t('maa.crop.save.open-folder') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-alert>
  </n-flex>
</template>

<style scoped>
.export-preview {
  width: 84px;
  height: 84px;
  object-fit: contain;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
  background: repeating-conic-gradient(rgba(128, 128, 128, 0.18) 0% 25%, transparent 0% 50%) 0 0 /
    12px 12px;
  flex: 0 0 auto;
}

.export-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, gray);
}

.export-hint {
  font-size: 11px;
}
</style>
