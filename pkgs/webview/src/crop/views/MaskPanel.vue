<script setup lang="ts">
import {
  NButton,
  NFlex,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NText
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import { t } from '../../utils/locale'
import ParamRow from '../components/ParamRow.vue'
import * as autoMaskSt from '../states/autoMask'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import * as maskApplySt from '../states/maskApply'
import * as subjectMaskSt from '../states/subjectMask'
import * as subjectSelectSt from '../states/subjectSelect'
import { clearFlash, flashSection } from '../states/visible'

const hasImage = computed(() => !!imageSt.data.value)

// 「跳转」标记：闪烁一下根容器即可
const flashing = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | undefined
watch(flashSection, section => {
  if (section !== 'mask') {
    return
  }
  flashing.value = true
  globalThis.clearTimeout(flashTimer)
  flashTimer = globalThis.setTimeout(() => {
    flashing.value = false
  }, 1200)
  clearFlash()
})

const maskMethods = computed(() => [
  { value: 'manual' as const, label: t('maa.crop.mask.method-manual') },
  { value: 'auto' as const, label: t('maa.crop.mask.method-auto') },
  { value: 'lasso' as const, label: t('maa.crop.mask.method-lasso') }
])
const autoMaskMethods = computed(() => [
  { label: t('maa.crop.tools.auto-mask-border-grow'), value: 'border-grow' },
  { label: t('maa.crop.tools.auto-mask-threshold'), value: 'threshold' }
])

function toggleManualMask() {
  if (greenMaskSt.drawing.value) {
    greenMaskSt.drawing.value = false
  } else {
    greenMaskSt.start()
  }
}

function toggleLasso() {
  if (subjectSelectSt.active.value) {
    subjectSelectSt.cancel()
  } else {
    subjectSelectSt.start()
  }
}

function clearLasso() {
  subjectSelectSt.clear()
  subjectMaskSt.disable()
}

const autoMaskErrorText = computed(() => {
  if (!autoMaskSt.error.value) {
    return null
  }
  return autoMaskSt.error.value === 'empty'
    ? t('maa.crop.tools.auto-mask-empty')
    : t('maa.crop.tools.auto-mask-failed')
})

const subjectMaskErrorText = computed(() => {
  switch (subjectMaskSt.error.value) {
    case 'no-region':
      return t('maa.crop.tools.subject-mask-no-region')
    case 'bad-selection':
      return t('maa.crop.tools.subject-mask-bad-selection')
    case null:
      return null
    default:
      return t('maa.crop.tools.subject-mask-failed')
  }
})
</script>

<template>
  <div class="mask-panel" :class="{ 'panel-flash': flashing }">
    <n-radio-group v-model:value="greenMaskSt.method.value" size="small" class="segmented">
      <n-radio-button
        v-for="opt in maskMethods"
        :key="opt.value"
        :value="opt.value"
        :label="opt.label"
      ></n-radio-button>
    </n-radio-group>

    <template v-if="greenMaskSt.method.value === 'manual'">
      <n-text depth="3" class="hint">{{ t('maa.crop.mask.hint-manual') }}</n-text>
      <n-flex align="center" :size="8">
        <n-button
          size="small"
          :type="greenMaskSt.drawing.value ? 'primary' : 'default'"
          :disabled="!hasImage"
          @click="toggleManualMask()"
        >
          {{
            greenMaskSt.drawing.value
              ? t('maa.crop.mask.stop-paint')
              : t('maa.crop.mask.start-paint')
          }}
        </n-button>
        <n-button
          size="small"
          quaternary
          :disabled="greenMaskSt.undoSteps.value === 0"
          @click="greenMaskSt.undo()"
        >
          {{ t('maa.crop.tools.undo') }}
        </n-button>
        <n-button
          size="small"
          quaternary
          :disabled="!greenMaskSt.hasContent.value"
          @click="greenMaskSt.clear()"
        >
          {{ t('maa.crop.tools.clear') }}
        </n-button>
      </n-flex>
      <div class="param-grid">
        <param-row :label="t('maa.crop.tools.brush-size')">
          <n-input-number
            v-model:value="greenMaskSt.brushSize.value"
            :min="1"
            :max="100"
            :step="1"
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row :label="t('maa.crop.tools.eraser')">
          <n-switch v-model:value="greenMaskSt.isEraser.value" size="small" />
        </param-row>
      </div>
    </template>

    <template v-else-if="greenMaskSt.method.value === 'auto'">
      <n-text depth="3" class="hint">{{ t('maa.crop.tools.auto-mask-scope') }}</n-text>
      <div class="param-grid">
        <param-row :label="t('maa.crop.mask.auto-method')">
          <n-select
            v-model:value="autoMaskSt.method.value"
            :options="autoMaskMethods"
            :consistent-menu-width="false"
            size="small"
            style="width: 140px"
          />
        </param-row>
        <param-row :label="t('maa.crop.tools.auto-mask-tolerance')">
          <n-input-number
            v-model:value="autoMaskSt.tolerance.value"
            :min="0"
            :max="255"
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row :label="t('maa.crop.tools.auto-mask-expand')">
          <n-input-number
            v-model:value="autoMaskSt.expand.value"
            :min="0"
            :max="8"
            size="small"
            style="width: 110px"
          />
        </param-row>
        <param-row :label="t('maa.crop.mask.preview')">
          <n-switch
            :value="autoMaskSt.enabled.value"
            :disabled="!hasImage"
            size="small"
            @update:value="autoMaskSt.setEnabled"
          />
          <n-text v-if="autoMaskErrorText" type="error" class="hint">
            {{ autoMaskErrorText }}
          </n-text>
          <n-text v-else-if="autoMaskSt.enabled.value" depth="3" class="hint">
            {{
              t(
                'maa.crop.tools.auto-mask-stats',
                `${autoMaskSt.backgroundPixels.value}`,
                autoMaskSt.ratio.value.toFixed(2)
              )
            }}
          </n-text>
        </param-row>
      </div>
    </template>

    <template v-else>
      <n-text depth="3" class="hint">{{ t('maa.crop.tools.subject-mask-hint') }}</n-text>
      <n-flex align="center" :size="8">
        <n-button
          size="small"
          :type="subjectSelectSt.active.value ? 'primary' : 'default'"
          :disabled="!hasImage"
          @click="toggleLasso()"
        >
          {{
            subjectSelectSt.active.value
              ? t('maa.crop.tools.subject-select-stop')
              : subjectSelectSt.hasRegion.value
                ? t('maa.crop.tools.subject-select-restart')
                : t('maa.crop.tools.subject-select-start')
          }}
        </n-button>
        <n-button
          v-if="subjectSelectSt.hasRegion.value"
          size="small"
          quaternary
          @click="clearLasso()"
        >
          {{ t('maa.crop.tools.subject-select-clear') }}
        </n-button>
      </n-flex>
      <n-text v-if="subjectMaskErrorText" type="error" class="hint">
        {{ subjectMaskErrorText }}
      </n-text>
      <n-text v-else-if="subjectMaskSt.previewCanvas.value" depth="3" class="hint">
        {{
          t(
            'maa.crop.tools.subject-mask-stats',
            subjectMaskSt.subjectRatio.value.toFixed(2),
            (100 - subjectMaskSt.subjectRatio.value).toFixed(2)
          )
        }}
      </n-text>
    </template>

    <div class="section-footer">
      <Tooltip trigger="hover">
        <template #trigger>
          <span style="display: inline-flex">
            <n-button
              type="primary"
              size="small"
              :disabled="!maskApplySt.pending.value"
              @click="maskApplySt.apply()"
            >
              {{ t('maa.crop.mask.apply') }}
            </n-button>
          </span>
        </template>
        {{
          maskApplySt.pending.value
            ? t('maa.crop.tooltip.apply-mask')
            : t('maa.crop.mask.nothing-to-apply')
        }}
      </Tooltip>
      <n-button v-if="greenMaskSt.appliedFrom.value" size="small" @click="maskApplySt.undoApply()">
        {{ t('maa.crop.tools.undo-apply') }}
      </n-button>
    </div>
    <n-text v-if="greenMaskSt.appliedFrom.value" depth="3" class="hint">
      {{
        greenMaskSt.appliedCount.value > 1
          ? `${t('maa.crop.tools.mask-applied')} ×${greenMaskSt.appliedCount.value}`
          : t('maa.crop.tools.mask-applied')
      }}
    </n-text>
  </div>
</template>

<style scoped>
.mask-panel {
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

.segmented {
  display: flex;
}

.segmented :deep(.n-radio-button) {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3));
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
</style>
