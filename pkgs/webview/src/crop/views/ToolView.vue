<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'
import { computed, ref } from 'vue'

import Tooltip from '../../components/AppTooltip.vue'
import JsonCode from '../../components/JsonCode.vue'
import { t } from '../../utils/locale'
import ColorBox from '../components/ColorBox.vue'
import RecoDetail from '../components/RecoDetail.vue'
import RoiEdit from '../components/RoiEdit.vue'
import { ipc } from '../ipc'
import { hostState } from '../state'
import * as autoMaskSt from '../states/autoMask'
import * as colorPreviewSt from '../states/colorPreview'
import * as controlSt from '../states/control'
import * as greenMaskSt from '../states/greenMask'
import * as imageSt from '../states/image'
import * as pickSt from '../states/pick'
import * as matchSt from '../states/quickMatch'
import * as recoSt from '../states/reco'
import * as settingsSt from '../states/settings'
import * as subjectMaskSt from '../states/subjectMask'
import * as subjectSelectSt from '../states/subjectSelect'

const drawOptions = computed(() =>
  (['all', 'best', 'filtered'] as const).map(value => ({
    value,
    label: t(`maa.crop.tools.draw-${value}`)
  }))
)

const colorMethodLabel = computed<Record<4 | 40 | 6, string>>(() => ({
  4: 'RGB',
  40: 'HSV',
  6: t('maa.crop.tools.gray')
}))

/** OpenCV 模板匹配算法，用可读名称代替裸数字 */
const templateMatchMethods = [
  { value: 10001 as const, label: 'SQDIFF_NORMED' },
  { value: 3 as const, label: 'CCORR_NORMED' },
  { value: 5 as const, label: 'CCOEFF_NORMED' }
]

// ColorMatch 的结果范围来自取色采样，这里把来源展示给用户
const autoMaskMethods = computed(() => [
  { label: t('maa.crop.tools.auto-mask-border-grow'), value: 'border-grow' },
  { label: t('maa.crop.tools.auto-mask-threshold'), value: 'threshold' }
])

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

const autoMaskErrorText = computed(() => {
  if (!autoMaskSt.error.value) {
    return null
  }
  return autoMaskSt.error.value === 'empty'
    ? t('maa.crop.tools.auto-mask-empty')
    : t('maa.crop.tools.auto-mask-failed')
})

const colorSourceText = computed(() => {
  const threshold = hostState.value.pickColorThreshold ?? 10
  if (!pickSt.recommendedRanges(threshold)) {
    return t('maa.crop.tools.color-source-empty')
  }
  return t(
    'maa.crop.tools.color-source',
    `${pickSt.samplePoints.value.length}`,
    colorMethodLabel.value[pickSt.colorMethod.value],
    `${threshold}`
  )
})

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

function startGreenMask() {
  if (imageSt.element.value) {
    greenMaskSt.init(imageSt.element.value.width, imageSt.element.value.height)
  }
  greenMaskSt.drawing.value = true
}

async function applyGreenMask() {
  const newData = greenMaskSt.applyMask()
  if (newData) {
    const previous = imageSt.data.value
    await imageSt.set(newData)
    // set 会重置 mask 状态，快照必须在上图之后记录
    greenMaskSt.markApplied(previous)
    greenMaskSt.drawing.value = false
    // 模板里一旦烘焙了绿幕，匹配参数必须打开 green_mask，否则涂了等于没涂
    matchSt.greenMask.value = true
  }
}

function copyColorSnippet() {
  const ranges = pickSt.recommendedRanges(hostState.value.pickColorThreshold ?? 10)
  if (!ranges) {
    return
  }
  const roi = controlSt.requestRoi()
  const text = [
    '"recognition": "ColorMatch",',
    `"roi": [${roi.join(', ')}],`,
    `"method": ${pickSt.colorMethod.value},`,
    `"lower": ${JSON.stringify(ranges.lower)},`,
    `"upper": ${JSON.stringify(ranges.upper)},`,
    `"count": ${Math.max(Math.round(matchSt.colorCount.value ?? 1), 1)},`,
    `"connected": ${matchSt.colorConnected.value}`
  ].join('\n')
  ipc.send({ command: 'writeClipboard', text })
}

async function applyAutoMask() {
  const newData = autoMaskSt.apply()
  if (!newData) {
    return
  }
  const previous = imageSt.data.value
  await imageSt.set(newData)
  greenMaskSt.markApplied(previous)
  matchSt.greenMask.value = true
  autoMaskSt.setEnabled(false)
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

async function applySubjectMask() {
  const newData = subjectMaskSt.apply()
  if (!newData) {
    return
  }
  const previous = imageSt.data.value
  await imageSt.set(newData)
  greenMaskSt.markApplied(previous)
  matchSt.greenMask.value = true
  subjectMaskSt.disable()
  subjectSelectSt.clear()
}

async function undoApplyGreenMask() {
  const previous = greenMaskSt.appliedFrom.value
  if (previous) {
    await imageSt.restoreWithoutHistory(previous)
    greenMaskSt.markRestored()
  }
}
</script>

<template>
  <n-flex vertical>
    <n-card :title="t('maa.crop.tools.pick-color')" size="small">
      <template #header-extra>
        <n-flex>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button v-if="!pickSt.picking.value" size="small" @click="pickSt.start()">
                {{ t('maa.crop.tools.pick-point') }}
              </n-button>
              <n-button v-else size="small" @click="pickSt.picking.value = false">
                {{ t('maa.control.stop') }}
              </n-button>
            </template>
            {{
              pickSt.picking.value
                ? t('maa.crop.tooltip.stop-pick')
                : t('maa.crop.tooltip.pick-point')
            }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button v-if="!pickSt.selecting.value" size="small" @click="pickSt.startSelect()">
                {{ t('maa.crop.tools.pick-rect') }}
              </n-button>
              <n-button v-else size="small" @click="pickSt.selecting.value = false">
                {{ t('maa.control.stop') }}
              </n-button>
            </template>
            {{
              pickSt.selecting.value
                ? t('maa.crop.tooltip.stop-rect')
                : t('maa.crop.tooltip.pick-rect')
            }}
          </Tooltip>
        </n-flex>
      </template>

      <template v-if="pickSt.color.value">
        <n-flex align="center">
          <color-box :color="`rgb(${pickSt.color.value.join(',')})`"></color-box>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="pickSt.copyCss()">
                HEX: {{ pickSt.cssText() }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.copy-hex') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="pickSt.copyArray(0, 4)">
                RGB: {{ pickSt.arrayText(0, 4) }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.copy-rgb') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="pickSt.copyHsv()">
                HSV: {{ pickSt.hsvText() }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.copy-hsv') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="pickSt.copyArray(0, 6)">
                {{ t('maa.crop.tools.gray') }}: {{ pickSt.arrayText(0, 6) }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.copy-gray') }}
          </Tooltip>
        </n-flex>
      </template>

      <template v-if="pickSt.samplePoints.value.length > 0">
        <n-flex vertical style="margin-top: 8px">
          <n-flex>
            <Tooltip trigger="hover">
              <template #trigger>
                <n-select
                  v-model:value="pickSt.colorMethod.value"
                  :options="[
                    { label: 'RGB', value: 4 },
                    { label: 'HSV', value: 40 },
                    { label: t('maa.crop.tools.gray'), value: 6 }
                  ]"
                  size="small"
                  style="width: 80px"
                />
              </template>
              {{ t('maa.crop.tooltip.color-method') }}
            </Tooltip>
            <Tooltip trigger="hover">
              <template #trigger>
                <n-select
                  v-model:value="pickSt.recommendMethod.value"
                  :options="[
                    { label: 'Min / Max', value: 'minmax' },
                    { label: 'Mean ± Std', value: 'meanstd' }
                  ]"
                  size="small"
                  style="width: 130px"
                />
              </template>
              {{ t('maa.crop.tooltip.recommend-method') }}
            </Tooltip>
            <Tooltip trigger="hover">
              <template #trigger>
                <n-button size="small" @click="pickSt.clearSamplePoints()">
                  {{ t('maa.crop.tools.clear-samples') }}
                </n-button>
              </template>
              {{ t('maa.crop.tooltip.clear-samples') }}
            </Tooltip>
            <Tooltip trigger="hover">
              <template #trigger>
                <n-input-number
                  v-model:value="settingsSt.pickColorThreshold.val"
                  :min="0"
                  :show-button="false"
                  size="small"
                  style="width: 84px"
                />
              </template>
              {{ t('maa.crop.tooltip.pick-color-threshold') }}
            </Tooltip>
            <n-text>{{ t('maa.crop.settings.pick-color-threshold') }}</n-text>
            <Tooltip trigger="hover">
              <template #trigger>
                <n-button
                  size="small"
                  :type="colorPreviewSt.enabled.value ? 'primary' : 'default'"
                  @click="colorPreviewSt.setEnabled(!colorPreviewSt.enabled.value)"
                >
                  {{
                    colorPreviewSt.enabled.value
                      ? t('maa.crop.tools.color-preview-stop')
                      : t('maa.crop.tools.color-preview')
                  }}
                </n-button>
              </template>
              {{ t('maa.crop.tooltip.color-preview') }}
            </Tooltip>
            <n-text v-if="colorPreviewSt.enabled.value" depth="3" style="font-size: 12px">
              {{
                t(
                  'maa.crop.tools.color-preview-stats',
                  `${colorPreviewSt.matched.value}`,
                  colorPreviewSt.ratio.value.toFixed(2)
                )
              }}
            </n-text>
          </n-flex>
          <n-text strong>{{ t('maa.crop.tools.recommended-range') }}</n-text>
          <template v-if="pickSt.recommendedColors.value">
            <n-flex>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button size="small" @click="pickSt.copyRecommendedLower()">
                    lower: {{ pickSt.recommendedLowerText() }}
                  </n-button>
                </template>
                {{ t('maa.crop.tooltip.copy-lower') }}
              </Tooltip>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button size="small" @click="pickSt.copyRecommendedUpper()">
                    upper: {{ pickSt.recommendedUpperText() }}
                  </n-button>
                </template>
                {{ t('maa.crop.tooltip.copy-upper') }}
              </Tooltip>
            </n-flex>
            <n-flex>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    size="small"
                    @click="pickSt.copyRecommendedLower(hostState.pickColorThreshold ?? 10)"
                  >
                    lower -{{ hostState.pickColorThreshold ?? 10 }}:
                    {{ pickSt.recommendedLowerText(hostState.pickColorThreshold ?? 10) }}
                  </n-button>
                </template>
                {{ t('maa.crop.tooltip.copy-lower-expanded') }}
              </Tooltip>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    size="small"
                    @click="pickSt.copyRecommendedUpper(hostState.pickColorThreshold ?? 10)"
                  >
                    upper +{{ hostState.pickColorThreshold ?? 10 }}:
                    {{ pickSt.recommendedUpperText(hostState.pickColorThreshold ?? 10) }}
                  </n-button>
                </template>
                {{ t('maa.crop.tooltip.copy-upper-expanded') }}
              </Tooltip>
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button size="small" @click="copyColorSnippet()">
                    {{ t('maa.crop.tools.copy-color-snippet') }}
                  </n-button>
                </template>
                {{ t('maa.crop.tooltip.copy-color-snippet') }}
              </Tooltip>
            </n-flex>
          </template>

          <n-text
            >{{ t('maa.crop.tools.sample-points') }} ({{
              pickSt.samplePoints.value.length
            }})</n-text
          >
          <n-flex wrap>
            <n-flex
              v-for="point in pickSt.samplePoints.value"
              :key="point.id"
              align="center"
              style="border: 1px solid #ccc; padding: 2px 4px; border-radius: 4px"
            >
              <color-box :color="`rgb(${point.color.join(',')})`"></color-box>
              <n-text style="font-size: 12px"
                >[{{ pickSt.formatColorText(point.color, pickSt.colorMethod.value) }}]</n-text
              >
              <Tooltip trigger="hover">
                <template #trigger>
                  <n-button size="tiny" @click="pickSt.removeSamplePoint(point.id)">✕</n-button>
                </template>
                {{ t('maa.crop.tooltip.remove-sample') }}
              </Tooltip>
            </n-flex>
          </n-flex>
        </n-flex>
      </template>
    </n-card>

    <n-card :title="t('maa.crop.tools.green-mask')" size="small">
      <template #header-extra>
        <n-flex>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button v-if="!greenMaskSt.drawing.value" size="small" @click="startGreenMask()">
                {{ t('maa.control.start') }}
              </n-button>
              <n-button v-else size="small" @click="greenMaskSt.drawing.value = false">
                {{ t('maa.control.stop') }}
              </n-button>
            </template>
            {{
              greenMaskSt.drawing.value
                ? t('maa.crop.tooltip.stop-mask')
                : t('maa.crop.tooltip.start-mask')
            }}
          </Tooltip>
        </n-flex>
      </template>

      <n-flex vertical>
        <n-flex align="center">
          <n-text>{{ t('maa.crop.tools.brush-size') }}</n-text>
          <n-input-number
            v-model:value="greenMaskSt.brushSize.value"
            :min="1"
            :max="100"
            :step="1"
            size="small"
            style="width: 100px"
          />
          <n-switch v-model:value="greenMaskSt.isEraser.value" />
          <n-text>{{ t('maa.crop.tools.eraser') }}</n-text>
        </n-flex>
        <n-flex>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="greenMaskSt.undo()">
                {{ t('maa.crop.tools.undo') }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.undo-mask') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" @click="greenMaskSt.clear()">
                {{ t('maa.crop.tools.clear') }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.clear-mask') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" type="primary" @click="applyGreenMask()">
                {{ t('maa.crop.tools.apply') }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.apply-mask') }}
          </Tooltip>
          <n-button v-if="greenMaskSt.appliedFrom.value" size="small" @click="undoApplyGreenMask()">
            {{ t('maa.crop.tools.undo-apply') }}
          </n-button>
        </n-flex>
        <n-text v-if="greenMaskSt.appliedFrom.value" depth="3" style="font-size: 12px">
          {{ t('maa.crop.tools.mask-applied') }}
        </n-text>

        <n-divider style="margin: 4px 0">{{ t('maa.crop.tools.auto-mask') }}</n-divider>
        <n-flex align="center" wrap>
          <n-select
            v-model:value="autoMaskSt.method.value"
            :options="autoMaskMethods"
            size="small"
            style="width: 120px"
          ></n-select>
          <n-text>{{ t('maa.crop.tools.auto-mask-tolerance') }}</n-text>
          <n-input-number
            v-model:value="autoMaskSt.tolerance.value"
            :min="0"
            :max="255"
            size="small"
            style="width: 84px"
          />
          <n-text>{{ t('maa.crop.tools.auto-mask-expand') }}</n-text>
          <n-input-number
            v-model:value="autoMaskSt.expand.value"
            :min="0"
            :max="8"
            size="small"
            style="width: 76px"
          />
          <n-button
            size="small"
            :type="autoMaskSt.enabled.value ? 'primary' : 'default'"
            @click="autoMaskSt.setEnabled(!autoMaskSt.enabled.value)"
          >
            {{
              autoMaskSt.enabled.value
                ? t('maa.crop.tools.auto-mask-stop')
                : t('maa.crop.tools.auto-mask-preview')
            }}
          </n-button>
          <n-button size="small" type="primary" @click="applyAutoMask()">
            {{ t('maa.crop.tools.auto-mask-apply') }}
          </n-button>
        </n-flex>
        <n-text v-if="autoMaskErrorText" type="error" style="font-size: 12px">
          {{ autoMaskErrorText }}
        </n-text>
        <n-text v-else-if="autoMaskSt.enabled.value" depth="3" style="font-size: 12px">
          {{
            t(
              'maa.crop.tools.auto-mask-stats',
              `${autoMaskSt.backgroundPixels.value}`,
              autoMaskSt.ratio.value.toFixed(2)
            )
          }}
        </n-text>
        <n-text depth="3" style="font-size: 12px">
          {{ t('maa.crop.tools.auto-mask-scope') }}
        </n-text>

        <n-divider style="margin: 4px 0">{{ t('maa.crop.tools.subject-select') }}</n-divider>
        <n-flex align="center" wrap>
          <n-button
            size="small"
            :type="subjectSelectSt.active.value ? 'primary' : 'default'"
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
            size="small"
            :disabled="!subjectSelectSt.hasRegion.value"
            @click="subjectMaskSt.generate()"
          >
            {{ t('maa.crop.tools.subject-mask-generate') }}
          </n-button>
          <n-button
            size="small"
            type="primary"
            :disabled="!subjectMaskSt.previewCanvas.value"
            @click="applySubjectMask()"
          >
            {{ t('maa.crop.tools.subject-mask-apply') }}
          </n-button>
          <n-button v-if="subjectSelectSt.hasRegion.value" size="small" @click="clearLasso()">
            {{ t('maa.crop.tools.subject-select-clear') }}
          </n-button>
        </n-flex>
        <n-text depth="3" style="font-size: 12px">
          {{ t('maa.crop.tools.subject-mask-hint') }}
        </n-text>
        <n-text v-if="subjectMaskErrorText" type="error" style="font-size: 12px">
          {{ subjectMaskErrorText }}
        </n-text>
        <n-text v-else-if="subjectMaskSt.previewCanvas.value" depth="3" style="font-size: 12px">
          {{
            t(
              'maa.crop.tools.subject-mask-stats',
              subjectMaskSt.subjectRatio.value.toFixed(2),
              (100 - subjectMaskSt.subjectRatio.value).toFixed(2)
            )
          }}
        </n-text>
      </n-flex>
    </n-card>

    <n-card :title="t('maa.crop.tools.roi-offset')" size="small">
      <div
        style="
          display: grid;
          grid-template-columns: max-content 1fr;
          row-gap: 0.5rem;
          column-gap: 0.5rem;
          align-items: center;
        "
      >
        <n-text>ROI 1</n-text>
        <roi-edit v-model:value="roiX"></roi-edit>
        <n-text>ROI 2</n-text>
        <roi-edit v-model:value="roiY"></roi-edit>
        <n-text> 1 + 2 </n-text>
        <roi-edit :value="roiSum" readonly></roi-edit>
        <n-text> 2 - 1 </n-text>
        <roi-edit :value="roiDlt" readonly></roi-edit>
        <template v-if="hostState.isMAA">
          <n-text> rect_move </n-text>
          <roi-edit :value="roiRectMove" readonly></roi-edit>
        </template>
      </div>
    </n-card>

    <n-card :title="t('maa.crop.tools.quick-match')" size="small">
      <template #header-extra>
        <n-flex>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" :loading="matchSt.loading.value" @click="matchSt.runOcr()">
                {{ t('maa.crop.tools.quick-match-ocr') }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.quick-ocr') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-button
                size="small"
                :loading="matchSt.loading.value"
                @click="matchSt.runTemplateMatch()"
              >
                {{ t('maa.crop.tools.quick-match-tmpl') }}
              </n-button>
            </template>
            {{ t('maa.crop.tooltip.quick-template') }}
          </Tooltip>
          <Tooltip trigger="hover">
            <template #trigger>
              <!-- 禁用态按钮不派发鼠标事件，套一层 span 保证 tooltip 仍可展示 -->
              <span style="display: inline-flex">
                <n-button
                  size="small"
                  :loading="matchSt.loading.value"
                  :disabled="!pickSt.recommendedColors.value"
                  @click="matchSt.runColorMatch()"
                >
                  {{ t('maa.crop.tools.quick-match-color') }}
                </n-button>
              </span>
            </template>
            {{
              pickSt.recommendedColors.value
                ? t('maa.crop.tooltip.quick-color')
                : t('maa.crop.tools.color-source-empty')
            }}
          </Tooltip>
        </n-flex>
      </template>

      <n-alert v-if="matchSt.error.value" type="error" style="margin-bottom: 8px">
        {{ matchSt.error.value }}
      </n-alert>

      <!-- 参数常驻：跑之前就能改，不再只在结果分支里出现（P0-C） -->
      <n-flex align="center" wrap style="margin-bottom: 8px">
        <template v-if="matchSt.selectedKind.value === 'ocr'">
          <n-switch v-model:value="matchSt.onlyRec.value" />
          <n-text> only_rec </n-text>
        </template>
        <template v-else-if="matchSt.selectedKind.value === 'template'">
          <n-switch v-model:value="matchSt.greenMask.value" />
          <n-text> green_mask </n-text>
          <n-text
            v-if="greenMaskSt.hasContent.value || greenMaskSt.appliedFrom.value"
            depth="3"
            style="font-size: 12px"
          >
            {{ t('maa.crop.tools.green-mask-source') }}
          </n-text>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-select
                :options="templateMatchMethods"
                v-model:value="matchSt.method.value"
                size="small"
                style="width: 160px"
              ></n-select>
            </template>
            {{ t('maa.crop.tooltip.match-method') }}
          </Tooltip>
          <n-text> method </n-text>
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
            style="width: 90px"
          />
          <n-text> threshold </n-text>
        </template>
        <template v-else>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-input-number
                v-model:value="matchSt.colorCount.value"
                :min="1"
                :precision="0"
                size="small"
                style="width: 90px"
              />
            </template>
            {{ t('maa.crop.tooltip.color-count') }}
          </Tooltip>
          <n-text> {{ t('maa.crop.tools.color-count') }} </n-text>
          <Tooltip trigger="hover">
            <template #trigger>
              <n-switch v-model:value="matchSt.colorConnected.value" />
            </template>
            {{ t('maa.crop.tooltip.color-connected') }}
          </Tooltip>
          <n-text> {{ t('maa.crop.tools.color-connected') }} </n-text>
          <n-text depth="3" style="font-size: 12px">{{ colorSourceText }}</n-text>
        </template>
      </n-flex>

      <template v-if="matchSt.resultKind.value">
        <n-flex vertical>
          <n-flex align="center">
            <n-switch v-model:value="matchSt.draw.value"> </n-switch>
            <n-text> {{ t('maa.crop.tools.draw') }} </n-text>
            <div style="flex: 1"></div>
          </n-flex>

          <template v-if="matchSt.result.value">
            <n-text> {{ t('maa.crop.tools.draw-mode') }} </n-text>
            <n-select
              v-model:value="matchSt.drawType.value"
              :options="drawOptions"
              size="small"
            ></n-select>
            <reco-detail
              v-if="matchSt.resultObject.value"
              :detail="matchSt.resultObject.value"
            ></reco-detail>
            <json-code :code="matchSt.result.value"></json-code>
          </template>
          <n-text v-else-if="!matchSt.error.value" depth="3">
            {{ t('maa.crop.reco.no-result') }}
          </n-text>
        </n-flex>
      </template>
    </n-card>

    <n-card v-if="!hostState.isMAA" :title="t('maa.crop.tools.quick-reco')" size="small">
      <template #header-extra>
        <Tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" :loading="recoSt.loading.value" @click="recoSt.perform()">
              {{ t('maa.crop.tools.quick-reco-run') }}
            </n-button>
          </template>
          {{ t('maa.crop.tooltip.quick-reco') }}
        </Tooltip>
      </template>

      <n-flex vertical>
        <n-alert v-if="recoSt.error.value" type="error">{{ recoSt.error.value }}</n-alert>
        <template v-if="recoSt.result.value">
          <reco-detail
            v-if="recoSt.resultObject.value"
            :detail="recoSt.resultObject.value"
          ></reco-detail>
          <json-code :code="recoSt.result.value"></json-code>
        </template>
        <n-text v-else-if="recoSt.ran.value && !recoSt.error.value" depth="3">
          {{ t('maa.crop.reco.no-result') }}
        </n-text>
        <n-text depth="3" style="font-size: 12px">{{ t('maa.crop.reco.agent-hint') }}</n-text>
      </n-flex>
    </n-card>
  </n-flex>
</template>
