<script setup lang="ts">
import { NButton, NFlex, NInputNumber, NSelect, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import ColorBox from '../components/ColorBox.vue'
import CopyChip from '../components/CopyChip.vue'
import ParamRow from '../components/ParamRow.vue'
import SnippetVersion from '../components/SnippetVersion.vue'
import { hostState } from '../state'
import * as colorPreviewSt from '../states/colorPreview'
import * as controlSt from '../states/control'
import * as imageSt from '../states/image'
import * as pickSt from '../states/pick'
import * as matchSt from '../states/quickMatch'
import * as settingsSt from '../states/settings'
import { clearFlash, flashSection, pipelineVersion, requestRun } from '../states/visible'
import { useCopy } from '../utils/copy'
import { colorMatchSnippet } from '../utils/pipelineSnippet'

const pickThreshold = computed(() => hostState.value.pickColorThreshold ?? 10)
const hasImage = computed(() => !!imageSt.data.value)

// 「跳转」标记：闪烁一下根容器即可
const flashing = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | undefined
watch(flashSection, section => {
  if (section !== 'pick') {
    return
  }
  flashing.value = true
  globalThis.clearTimeout(flashTimer)
  flashTimer = globalThis.setTimeout(() => {
    flashing.value = false
  }, 1200)
  clearFlash()
})

const colorMethods = computed(() => [
  { label: 'RGB', value: 4 },
  { label: 'HSV', value: 40 },
  { label: t('maa.crop.tools.gray'), value: 6 }
])
const recommendMethods = computed(() => [
  { label: t('maa.crop.pick.recommend-minmax'), value: 'minmax' },
  { label: t('maa.crop.pick.recommend-meanstd'), value: 'meanstd' }
])

function togglePickPoint() {
  if (pickSt.picking.value) {
    pickSt.picking.value = false
  } else {
    pickSt.start()
  }
}

function togglePickRect() {
  if (pickSt.selecting.value) {
    pickSt.selecting.value = false
  } else {
    pickSt.startSelect()
  }
}

const { copied: snippetCopied, copy: copySnippetText } = useCopy()

function copyColorSnippet() {
  const ranges = pickSt.effRanges(pickThreshold.value)
  if (!ranges) {
    return
  }
  copySnippetText(
    colorMatchSnippet(
      pipelineVersion.value,
      controlSt.requestRoi(),
      pickSt.colorMethod.value,
      ranges.lower,
      ranges.upper,
      Math.max(Math.round(matchSt.colorCount.value ?? 1), 1),
      matchSt.colorConnected.value
    )
  )
}
</script>

<template>
  <div class="color-panel" :class="{ 'panel-flash': flashing }">
    <n-flex align="center" :size="8">
      <n-button
        size="small"
        :type="pickSt.picking.value ? 'primary' : 'default'"
        :disabled="!hasImage"
        @click="togglePickPoint()"
      >
        {{ pickSt.picking.value ? t('maa.crop.pick.stop') : t('maa.crop.tools.pick-point') }}
      </n-button>
      <n-button
        size="small"
        :type="pickSt.selecting.value ? 'primary' : 'default'"
        :disabled="!hasImage"
        @click="togglePickRect()"
      >
        {{ pickSt.selecting.value ? t('maa.crop.pick.stop') : t('maa.crop.tools.pick-rect') }}
      </n-button>
      <n-button
        v-if="pickSt.samplePoints.value.length > 0"
        size="small"
        quaternary
        @click="pickSt.clearSamplePoints()"
      >
        {{ t('maa.crop.tools.clear-samples') }}
      </n-button>
    </n-flex>
    <n-text
      v-if="pickSt.samplePoints.value.length === 0 && !pickSt.color.value"
      depth="3"
      class="hint"
    >
      {{ t('maa.crop.pick.hint') }}
    </n-text>

    <n-flex v-if="pickSt.color.value" align="center" :size="6">
      <color-box :color="`rgb(${pickSt.color.value.join(',')})`"></color-box>
      <copy-chip
        label="HEX"
        :value="pickSt.cssText()"
        :tooltip="t('maa.crop.tooltip.copy-hex')"
      ></copy-chip>
      <copy-chip
        label="RGB"
        :value="pickSt.arrayText(0, 4) ?? ''"
        :tooltip="t('maa.crop.tooltip.copy-rgb')"
      ></copy-chip>
      <copy-chip
        label="HSV"
        :value="pickSt.hsvText() ?? ''"
        :tooltip="t('maa.crop.tooltip.copy-hsv')"
      ></copy-chip>
      <copy-chip
        :label="t('maa.crop.tools.gray')"
        :value="pickSt.arrayText(0, 6) ?? ''"
        :tooltip="t('maa.crop.tooltip.copy-gray')"
      ></copy-chip>
    </n-flex>

    <template v-if="pickSt.samplePoints.value.length > 0">
      <!-- 采样点表格：色块 / 坐标 / 来源 / 删除 -->
      <div class="sample-list">
        <div v-for="point in pickSt.samplePoints.value" :key="point.id" class="sample-row">
          <span class="swatch" :style="{ background: `rgb(${point.color.join(',')})` }"></span>
          <span class="sample-color">
            {{ pickSt.formatColorText(point.color, pickSt.colorMethod.value) }}
          </span>
          <span class="sample-pos">({{ point.pos[0] }}, {{ point.pos[1] }})</span>
          <span class="sample-src">
            {{
              point.src === 'point' ? t('maa.crop.pick.src-point') : t('maa.crop.pick.src-region')
            }}
          </span>
          <n-button
            text
            size="tiny"
            type="error"
            :title="t('maa.crop.tooltip.remove-sample')"
            @click="pickSt.removeSamplePoint(point.id)"
          >
            ✕
          </n-button>
        </div>
      </div>

      <div class="param-grid">
        <param-row
          :label="t('maa.crop.pick.color-space')"
          field="method"
          :tooltip="t('maa.crop.tooltip.color-method')"
        >
          <n-select
            v-model:value="pickSt.colorMethod.value"
            :options="colorMethods"
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row
          :label="t('maa.crop.pick.recommend')"
          :tooltip="t('maa.crop.tooltip.recommend-method')"
        >
          <n-select
            v-model:value="pickSt.recommendMethod.value"
            :options="recommendMethods"
            :consistent-menu-width="false"
            size="small"
            style="width: 160px"
          />
        </param-row>
        <param-row
          :label="t('maa.crop.pick.tolerance')"
          :tooltip="t('maa.crop.tooltip.pick-color-threshold')"
        >
          <n-input-number
            v-model:value="settingsSt.pickColorThreshold.val"
            :placeholder="`${settingsSt.pickColorThreshold.def}`"
            :min="0"
            size="small"
            style="width: 110px"
          />
        </param-row>
      </div>

      <!-- 每通道区间：直接改 effRaw；改过任一通道标记为「手动」，可一键恢复推荐 -->
      <div v-if="pickSt.effRaw.value" class="range-edit">
        <n-flex align="center" :size="6">
          <n-text class="hint">{{ t('maa.crop.tools.recommended-range') }}</n-text>
          <span v-if="pickSt.customRange.value" class="range-tag">
            {{ t('maa.crop.pick.manual') }}
          </span>
          <div style="flex: 1"></div>
          <n-button
            v-if="pickSt.customRange.value"
            text
            size="tiny"
            type="primary"
            @click="pickSt.resetCustomRange()"
          >
            {{ t('maa.crop.pick.reset-range') }}
          </n-button>
        </n-flex>
        <div
          v-for="(label, i) in pickSt.channelLabels(pickSt.colorMethod.value)"
          :key="label"
          class="range-row"
        >
          <span class="range-label">{{ label }}</span>
          <n-input-number
            :value="pickSt.effRaw.value.lower[i]"
            :min="0"
            :max="pickSt.channelMax(i, pickSt.colorMethod.value)"
            :precision="0"
            size="tiny"
            class="range-input"
            @update:value="
              v => pickSt.setCustomChannel(i, 'lower', v ?? pickSt.effRaw.value!.lower[i]!)
            "
          />
          <span class="range-sep">—</span>
          <n-input-number
            :value="pickSt.effRaw.value.upper[i]"
            :min="0"
            :max="pickSt.channelMax(i, pickSt.colorMethod.value)"
            :precision="0"
            size="tiny"
            class="range-input"
            @update:value="
              v => pickSt.setCustomChannel(i, 'upper', v ?? pickSt.effRaw.value!.upper[i]!)
            "
          />
        </div>
        <n-flex align="center" :size="6">
          <copy-chip
            label="lower"
            :value="pickSt.recommendedLowerText(pickThreshold) ?? ''"
            :tooltip="t('maa.crop.tooltip.copy-lower')"
          ></copy-chip>
          <copy-chip
            label="upper"
            :value="pickSt.recommendedUpperText(pickThreshold) ?? ''"
            :tooltip="t('maa.crop.tooltip.copy-upper')"
          ></copy-chip>
        </n-flex>
      </div>

      <n-flex align="center" :size="8">
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button
              size="small"
              :type="colorPreviewSt.enabled.value ? 'primary' : 'default'"
              :secondary="colorPreviewSt.enabled.value"
              @click="colorPreviewSt.setEnabled(!colorPreviewSt.enabled.value)"
            >
              {{ t('maa.crop.tools.color-preview') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.color-preview') }}
        </Tooltip>
        <n-text v-if="colorPreviewSt.enabled.value" depth="3" class="hint">
          {{
            t(
              'maa.crop.tools.color-preview-stats',
              `${colorPreviewSt.matched.value}`,
              colorPreviewSt.ratio.value.toFixed(2)
            )
          }}
        </n-text>
      </n-flex>
      <n-flex align="center" :size="8">
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" @click="copyColorSnippet()">
              {{ snippetCopied ? t('maa.crop.copied') : t('maa.crop.tools.copy-color-snippet') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.copy-color-snippet') }}
        </Tooltip>
        <snippet-version></snippet-version>
        <n-button size="small" type="primary" secondary @click="requestRun('color')">
          {{ t('maa.crop.pick.test') }}
        </n-button>
      </n-flex>
    </template>
  </div>
</template>

<style scoped>
.color-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
}

.panel-flash {
  animation: panel-flash 1.1s ease-out;
  border-radius: 3px;
}

@keyframes panel-flash {
  0% {
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.18));
    box-shadow: inset 0 0 0 1px var(--vscode-focusBorder, #007fd4);
  }
  70% {
    background: var(--vscode-textBlockQuote-background, rgba(128, 128, 128, 0.18));
    box-shadow: inset 0 0 0 1px var(--vscode-focusBorder, #007fd4);
  }
  100% {
    background: transparent;
    box-shadow: inset 0 0 0 1px transparent;
  }
}

.param-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 14px;
  row-gap: 8px;
  align-items: center;
}

.hint {
  font-size: 12px;
  line-height: 1.5;
}

.swatch {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.5));
  border-radius: 2px;
  cursor: pointer;
  flex: 0 0 auto;
}

.swatch:hover {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
}

.sample-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  padding: 4px;
}

.sample-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 1px 4px;
}

.sample-color {
  font-family: var(--vscode-editor-font-family, monospace);
  min-width: 72px;
}

.sample-pos {
  color: var(--vscode-descriptionForeground, gray);
  font-family: var(--vscode-editor-font-family, monospace);
}

.sample-src {
  flex: 1;
  color: var(--vscode-descriptionForeground, gray);
  font-size: 11px;
}

.range-edit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.25));
  border-radius: 4px;
  padding: 6px 8px;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.range-label {
  width: 36px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family, monospace);
}

.range-input {
  width: 76px;
}

.range-sep {
  color: var(--vscode-descriptionForeground, gray);
}

.range-tag {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 3px;
  color: var(--vscode-button-foreground, #fff);
  background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.4));
}
</style>
