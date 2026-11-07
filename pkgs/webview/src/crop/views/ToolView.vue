<script setup lang="ts">
import { default as CancelOutlined } from '@vicons/material/es/CancelOutlined'
import { default as CheckCircleOutlined } from '@vicons/material/es/CheckCircleOutlined'
import { default as PlayArrowOutlined } from '@vicons/material/es/PlayArrowOutlined'
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NFlex,
  NIcon,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSwitch,
  NText
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import ColorBox from '../components/ColorBox.vue'
import CopyChip from '../components/CopyChip.vue'
import ParamRow from '../components/ParamRow.vue'
import RecoDetail from '../components/RecoDetail.vue'
import RoiEdit from '../components/RoiEdit.vue'
import { hostState } from '../state'
import * as autoMaskSt from '../states/autoMask'
import * as colorPreviewSt from '../states/colorPreview'
import * as controlSt from '../states/control'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import * as maskApplySt from '../states/maskApply'
import * as pickSt from '../states/pick'
import * as matchSt from '../states/quickMatch'
import * as recoSt from '../states/reco'
import * as settingsSt from '../states/settings'
import * as subjectMaskSt from '../states/subjectMask'
import * as subjectSelectSt from '../states/subjectSelect'
import { type TestTarget, revealSection, testTarget, toolSections } from '../states/visible'
import { useCopy } from '../utils/copy'
import { summarize } from '../utils/recoDetail'

const pickThreshold = computed(() => hostState.value.pickColorThreshold ?? 10)
const hasImage = computed(() => !!imageSt.data.value)

// ---------- 识别测试 ----------

/**
 * MAA 模式不支持节点试跑；但外部（启动面板）送来的节点识别详情仍要能看，
 * 所以有结果时保留「节点」目标，只禁用运行。
 */
const nodeAvailable = computed(() => !hostState.value.isMAA || recoSt.ran.value)

const target = computed<TestTarget>({
  get: () => (testTarget.value === 'node' && !nodeAvailable.value ? 'template' : testTarget.value),
  set: value => {
    testTarget.value = value
  }
})

const targets = computed(() => {
  const list: { value: TestTarget; label: string }[] = [
    { value: 'template', label: t('maa.crop.test.target-template') },
    { value: 'ocr', label: 'OCR' },
    { value: 'color', label: t('maa.crop.test.target-color') }
  ]
  if (nodeAvailable.value) {
    list.push({ value: 'node', label: t('maa.crop.test.target-node') })
  }
  return list
})

// 括号里是 pipeline 里实际写的 method 值，方便对照 JSON
const templateMatchMethods = computed(() => [
  { value: 5 as const, label: 'CCOEFF_NORMED (5)' },
  { value: 3 as const, label: 'CCORR_NORMED (3)' },
  { value: 10001 as const, label: `SQDIFF_NORMED ${t('maa.crop.test.method-inverted')} (10001)` }
])

/** 当前识别范围的人话描述：用户需要知道识别究竟跑在哪片区域上 */
const scopeText = computed(() => {
  const roi = controlSt.requestRoi()
  return roi[2] > 0 && roi[3] > 0
    ? t('maa.crop.test.scope-roi', roi.join(', '))
    : t('maa.crop.test.scope-whole')
})

const targetHint = computed(() => {
  switch (target.value) {
    case 'template':
      return t('maa.crop.test.hint-template', scopeText.value)
    case 'ocr':
      return t('maa.crop.test.hint-ocr', scopeText.value)
    case 'color':
      return t('maa.crop.test.hint-color', scopeText.value)
    case 'node':
      return t('maa.crop.test.hint-node')
  }
  return ''
})

const runLabel = computed(() => {
  switch (target.value) {
    case 'template':
      return t('maa.crop.test.run-template')
    case 'ocr':
      return t('maa.crop.test.run-ocr')
    case 'color':
      return t('maa.crop.test.run-color')
    case 'node':
      return t('maa.crop.test.run-node')
  }
  return ''
})

const running = computed(() =>
  target.value === 'node' ? recoSt.loading.value : matchSt.loading.value
)
const runDisabledReason = computed(() => {
  if (!hasImage.value) {
    return t('maa.crop.test.need-image')
  }
  if (target.value === 'node' && hostState.value.isMAA) {
    return t('maa.crop.test.node-maa')
  }
  if (target.value === 'color' && !pickSt.recommendedColors.value) {
    return t('maa.crop.tools.color-source-empty')
  }
  return null
})
const canRun = computed(() => runDisabledReason.value === null)

function runTest() {
  if (!canRun.value || running.value) {
    return
  }
  if (target.value === 'node') {
    void recoSt.perform()
  } else {
    void matchSt.run(target.value)
  }
}

const testResult = computed(() => {
  if (target.value === 'node') {
    return {
      detail: recoSt.resultObject.value,
      raw: recoSt.result.value,
      ran: recoSt.ran.value,
      error: recoSt.error.value
    }
  }
  const mine = matchSt.resultKind.value === target.value
  return {
    detail: mine ? matchSt.resultObject.value : null,
    raw: mine ? matchSt.result.value : null,
    ran: mine,
    error: matchSt.activeKind.value === target.value ? matchSt.error.value : null
  }
})
const testSummary = computed(() =>
  testResult.value.detail ? summarize(testResult.value.detail) : null
)
const showOnCanvas = ref(true)
const showJson = ref(false)

// 只有烘焙进图像的绿色才会进入保存的模板；画布上未应用的笔画不算
const greenMaskFromImage = computed(() => !!greenMaskSt.appliedFrom.value)

const colorSourceText = computed(() =>
  t(
    'maa.crop.tools.color-source',
    `${pickSt.samplePoints.value.length}`,
    colorMethodLabel.value[pickSt.colorMethod.value],
    `${pickThreshold.value}`
  )
)

function gotoPick() {
  revealSection('pick')
  if (hasImage.value) {
    pickSt.start()
  }
}

function onKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    revealSection('test')
    runTest()
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ---------- 取色 ----------

const colorMethodLabel = computed<Record<4 | 40 | 6, string>>(() => ({
  4: 'RGB',
  40: 'HSV',
  6: t('maa.crop.tools.gray')
}))
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
  const ranges = pickSt.recommendedRanges(pickThreshold.value)
  if (!ranges) {
    return
  }
  const roi = controlSt.requestRoi()
  copySnippetText(
    [
      '"recognition": "ColorMatch",',
      `"roi": [${roi.join(', ')}],`,
      `"method": ${pickSt.colorMethod.value},`,
      `"lower": ${JSON.stringify(ranges.lower)},`,
      `"upper": ${JSON.stringify(ranges.upper)},`,
      `"count": ${Math.max(Math.round(matchSt.colorCount.value ?? 1), 1)},`,
      `"connected": ${matchSt.colorConnected.value}`
    ].join('\n')
  )
}

function testWithColor() {
  target.value = 'color'
  revealSection('test')
  runTest()
}

// ---------- 绿幕 ----------

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

const maskBadge = computed(() => {
  if (greenMaskSt.appliedFrom.value) {
    return t('maa.crop.mask.badge-applied')
  }
  if (maskApplySt.pending.value) {
    return t('maa.crop.mask.badge-pending')
  }
  return null
})

// ---------- ROI 计算 ----------

const roiX = ref<maa.Rect | undefined>([0, 0, 0, 0])
const roiY = ref<maa.Rect | undefined>([0, 0, 0, 0])
const roiSum = computed(() => {
  if (roiX.value && roiY.value) {
    return Array.from({ length: 4 }, (_, idx) => roiY.value![idx]! + roiX.value![idx]!) as maa.Rect
  }
  return undefined
})
const roiDlt = computed(() => {
  if (roiX.value && roiY.value) {
    return Array.from({ length: 4 }, (_, idx) => roiY.value![idx]! - roiX.value![idx]!) as maa.Rect
  }
  return undefined
})
const roiRectMove = computed(() => {
  if (roiX.value && roiY.value) {
    return [
      roiX.value[0] + roiY.value[0],
      roiX.value[1] + roiY.value[1],
      roiY.value[2],
      roiY.value[3]
    ] as maa.Rect
  }
  return undefined
})
</script>

<template>
  <n-collapse
    v-model:expanded-names="toolSections"
    :trigger-areas="['main', 'arrow']"
    class="tool-collapse"
  >
    <!-- 识别测试：面板的核心，默认放在最上方 -->
    <n-collapse-item name="test" :title="t('maa.crop.test.title')">
      <template #header-extra>
        <span
          v-if="testSummary"
          class="section-badge"
          :class="testSummary.hit ? 'is-hit' : 'is-miss'"
        >
          {{ testSummary.hit ? t('maa.crop.test.hit') : t('maa.crop.test.miss') }}
          <template v-if="testSummary.value"> · {{ testSummary.value }}</template>
        </span>
      </template>

      <div class="section">
        <n-radio-group v-model:value="target" size="small" class="segmented">
          <n-radio-button
            v-for="opt in targets"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          ></n-radio-button>
        </n-radio-group>
        <n-text depth="3" class="hint">{{ targetHint }}</n-text>

        <div v-if="target !== 'node'" class="param-grid">
          <template v-if="target === 'template'">
            <param-row
              :label="t('maa.crop.test.threshold')"
              field="threshold"
              :tooltip="t('maa.crop.tooltip.threshold')"
            >
              <n-input-number
                :value="settingsSt.templateMatchThreshold.eff"
                @update:value="
                  v => {
                    settingsSt.templateMatchThreshold.val = v ?? undefined
                  }
                "
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
                style="width: 110px"
              />
            </param-row>
            <param-row
              :label="t('maa.crop.test.method')"
              field="method"
              :tooltip="t('maa.crop.tooltip.match-method')"
            >
              <n-select
                v-model:value="matchSt.method.value"
                :options="templateMatchMethods"
                :consistent-menu-width="false"
                size="small"
                style="width: 210px"
              />
            </param-row>
            <param-row
              :label="t('maa.crop.test.green-mask')"
              field="green_mask"
              :tooltip="t('maa.crop.tooltip.green-mask')"
            >
              <n-switch v-model:value="matchSt.greenMask.value" size="small" />
              <n-text v-if="greenMaskFromImage" depth="3" class="hint">
                {{ t('maa.crop.tools.green-mask-source') }}
              </n-text>
            </param-row>
          </template>

          <template v-else-if="target === 'ocr'">
            <param-row
              :label="t('maa.crop.test.only-rec')"
              field="only_rec"
              :tooltip="t('maa.crop.tooltip.only-rec')"
            >
              <n-switch v-model:value="matchSt.onlyRec.value" size="small" />
            </param-row>
          </template>

          <template v-else-if="target === 'color'">
            <param-row :label="t('maa.crop.test.color-range')" field="lower / upper">
              <template v-if="pickSt.recommendedColors.value">
                <n-text>{{ colorSourceText }}</n-text>
                <n-button text type="primary" size="small" @click="revealSection('pick')">
                  {{ t('maa.crop.test.adjust') }}
                </n-button>
              </template>
              <template v-else>
                <n-text depth="3">{{ t('maa.crop.tools.color-source-empty') }}</n-text>
                <n-button size="tiny" :disabled="!hasImage" @click="gotoPick()">
                  {{ t('maa.crop.test.goto-pick') }}
                </n-button>
              </template>
            </param-row>
            <param-row
              :label="t('maa.crop.test.color-count')"
              field="count"
              :tooltip="t('maa.crop.tooltip.color-count')"
            >
              <n-input-number
                v-model:value="matchSt.colorCount.value"
                :min="1"
                :precision="0"
                size="small"
                style="width: 110px"
              />
            </param-row>
            <param-row
              :label="t('maa.crop.test.color-connected')"
              field="connected"
              :tooltip="t('maa.crop.tooltip.color-connected')"
            >
              <n-switch v-model:value="matchSt.colorConnected.value" size="small" />
            </param-row>
          </template>
        </div>

        <n-flex align="center" :size="8">
          <Tooltip trigger="hover">
            <template #trigger>
              <!-- 禁用态按钮不派发鼠标事件，套一层 span 保证 tooltip 仍可展示 -->
              <span style="display: inline-flex">
                <n-button
                  type="primary"
                  size="small"
                  :loading="running"
                  :disabled="!canRun"
                  @click="runTest()"
                >
                  <template #icon>
                    <n-icon><play-arrow-outlined></play-arrow-outlined></n-icon>
                  </template>
                  {{ runLabel }}
                </n-button>
              </span>
            </template>
            {{ runDisabledReason ?? t('maa.crop.tooltip.run-test') }}
          </Tooltip>
          <kbd class="kbd">Ctrl + Enter</kbd>
        </n-flex>
        <n-text v-if="target === 'node'" depth="3" class="hint">
          {{ t('maa.crop.reco.agent-hint') }}
        </n-text>

        <n-alert v-if="testResult.error" type="error" :show-icon="false" class="compact-alert">
          {{ testResult.error }}
        </n-alert>

        <template v-if="testResult.detail && testSummary">
          <div class="result-line" :class="testSummary.hit ? 'is-hit' : 'is-miss'">
            <n-icon size="18">
              <check-circle-outlined v-if="testSummary.hit"></check-circle-outlined>
              <cancel-outlined v-else></cancel-outlined>
            </n-icon>
            <strong>{{
              testSummary.hit ? t('maa.crop.test.hit') : t('maa.crop.test.miss')
            }}</strong>
            <span class="result-meta">{{ testSummary.algorithm }}</span>
            <span v-if="testSummary.value" class="result-value">
              {{ testSummary.hit ? '' : t('maa.crop.test.best-candidate') }}{{ testSummary.value }}
            </span>
            <div style="flex: 1"></div>
            <copy-chip
              v-if="testSummary.box"
              label="box"
              :value="testSummary.box.join(', ')"
              :text="JSON.stringify(testSummary.box)"
              :tooltip="t('maa.crop.tooltip.copy-box')"
            ></copy-chip>
          </div>
          <n-flex align="center" justify="space-between">
            <n-flex align="center" :size="6">
              <n-switch v-model:value="showOnCanvas" size="small" />
              <n-text>{{ t('maa.crop.test.show-on-canvas') }}</n-text>
            </n-flex>
            <n-button text size="small" @click="showJson = !showJson">
              {{ showJson ? t('maa.crop.test.hide-json') : t('maa.crop.test.show-json') }}
            </n-button>
          </n-flex>
          <reco-detail :key="target" :detail="testResult.detail" :draw="showOnCanvas"></reco-detail>
          <json-code v-if="showJson && testResult.raw" :code="testResult.raw"></json-code>
        </template>
        <n-text v-else-if="testResult.ran && !testResult.error" depth="3">
          {{ t('maa.crop.reco.no-result') }}
        </n-text>
      </div>
    </n-collapse-item>

    <!-- 取色 -->
    <n-collapse-item name="pick" :title="t('maa.crop.tools.pick-color')">
      <template #header-extra>
        <span v-if="pickSt.samplePoints.value.length > 0" class="section-badge">
          {{ t('maa.crop.pick.badge', `${pickSt.samplePoints.value.length}`) }}
        </span>
      </template>

      <div class="section">
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
          <div class="swatches">
            <button
              v-for="point in pickSt.samplePoints.value"
              :key="point.id"
              class="swatch"
              :style="{ background: `rgb(${point.color.join(',')})` }"
              :title="`[${pickSt.formatColorText(point.color, pickSt.colorMethod.value)}] · ${t('maa.crop.tooltip.remove-sample')}`"
              @click="pickSt.removeSamplePoint(point.id)"
            ></button>
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
            <param-row
              v-if="pickSt.recommendedColors.value"
              :label="t('maa.crop.tools.recommended-range')"
            >
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
            </param-row>
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
                  {{
                    snippetCopied ? t('maa.crop.copied') : t('maa.crop.tools.copy-color-snippet')
                  }}
                </n-button>
              </template>
              {{ t('maa.crop.tooltip.copy-color-snippet') }}
            </Tooltip>
            <n-button size="small" type="primary" secondary @click="testWithColor()">
              {{ t('maa.crop.pick.test') }}
            </n-button>
          </n-flex>
        </template>
      </div>
    </n-collapse-item>

    <!-- 绿幕：三种生成方式，共用一个「应用到图像」 -->
    <n-collapse-item name="mask" :title="t('maa.crop.tools.green-mask')">
      <template #header-extra>
        <span v-if="maskBadge" class="section-badge">{{ maskBadge }}</span>
      </template>

      <div class="section">
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
          <n-button
            v-if="greenMaskSt.appliedFrom.value"
            size="small"
            @click="maskApplySt.undoApply()"
          >
            {{ t('maa.crop.tools.undo-apply') }}
          </n-button>
        </div>
        <n-text v-if="greenMaskSt.appliedFrom.value" depth="3" class="hint">
          {{ t('maa.crop.tools.mask-applied') }}
        </n-text>
      </div>
    </n-collapse-item>

    <!-- ROI 计算：低频功能，默认收起 -->
    <n-collapse-item name="roi" :title="t('maa.crop.tools.roi-offset')">
      <div class="section">
        <n-text depth="3" class="hint">{{ t('maa.crop.roi-calc.hint') }}</n-text>
        <div class="roi-grid">
          <n-text>ROI 1</n-text>
          <roi-edit v-model:value="roiX"></roi-edit>
          <n-text>ROI 2</n-text>
          <roi-edit v-model:value="roiY"></roi-edit>
          <n-text>1 + 2</n-text>
          <roi-edit :value="roiSum" readonly></roi-edit>
          <n-text>2 - 1</n-text>
          <roi-edit :value="roiDlt" readonly></roi-edit>
          <template v-if="hostState.isMAA">
            <n-text>rect_move</n-text>
            <roi-edit :value="roiRectMove" readonly></roi-edit>
          </template>
        </div>
      </div>
    </n-collapse-item>
  </n-collapse>
</template>

<style scoped>
.tool-collapse {
  box-sizing: border-box;
  padding: 4px 12px 12px 12px;
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

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
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

.roi-grid {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 8px;
  row-gap: 8px;
  align-items: center;
}

.hint {
  font-size: 12px;
  line-height: 1.5;
}

.section-badge {
  font-size: 12px;
  color: var(--vscode-descriptionForeground, gray);
  white-space: nowrap;
}

.section-badge.is-hit,
.result-line.is-hit {
  color: var(--vscode-testing-iconPassed, #73c991);
}

.section-badge.is-miss,
.result-line.is-miss {
  color: var(--vscode-testing-iconFailed, #f14c4c);
}

.result-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid currentColor;
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.result-meta,
.result-value {
  color: var(--vscode-foreground, inherit);
}

.result-value {
  font-family: var(--vscode-editor-font-family, monospace);
}

.compact-alert {
  font-size: 12px;
}

.kbd {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--vscode-descriptionForeground, gray);
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4));
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  max-height: 58px;
  overflow-y: auto;
}

.swatch {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.5));
  border-radius: 2px;
  cursor: pointer;
}

.swatch:hover {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
}
</style>
